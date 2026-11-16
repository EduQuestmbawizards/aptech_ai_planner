from datetime import date, datetime, timedelta
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.planner import StudyPlan, StudyTask, StudySession, TaskStatus
from app.models.course import Course, CourseModule, CourseTopic
from app.schemas.progress import ProgressOverview, ModuleProgress, DailyStudyMetric

def _to_date(val) -> date:
    if isinstance(val, datetime):
        return val.date()
    return val

class AnalyticsService:
    @staticmethod
    def get_progress_overview(db: Session, student_id: str, plan_id: str) -> ProgressOverview:
        plan = db.query(StudyPlan).filter(StudyPlan.id == plan_id, StudyPlan.student_id == student_id).first()
        if not plan:
            return ProgressOverview(
                overall_progress_percent=0.0,
                total_syllabus_hours=0.0,
                planned_hours=0.0,
                actual_study_hours=0.0,
                total_tasks=0,
                completed_tasks=0,
                pending_tasks=0,
                missed_tasks=0,
                current_streak_days=0,
                target_completion_date=None,
                days_remaining=0,
                modules_progress=[],
                weekly_breakdown=[]
            )

        course = db.query(Course).filter(Course.id == plan.course_id).first()
        all_tasks = db.query(StudyTask).filter(StudyTask.study_plan_id == plan.id).all()
        
        total_tasks = len(all_tasks)
        completed_tasks = sum(1 for t in all_tasks if t.status == TaskStatus.COMPLETED.value)
        missed_tasks = sum(1 for t in all_tasks if t.status == TaskStatus.MISSED.value)
        pending_tasks = total_tasks - completed_tasks

        planned_hours = sum(t.estimated_duration_hours for t in all_tasks)
        
        # Fetch sessions for this plan's tasks and calculate actual study hours
        plan_task_ids = {t.id for t in all_tasks}
        plan_sessions = (
            db.query(StudySession)
            .join(StudyTask, StudySession.task_id == StudyTask.id)
            .filter(StudyTask.study_plan_id == plan.id)
            .all()
        )
        sessions_by_task: Dict[str, List[StudySession]] = {}
        daily_minutes_map: Dict[date, int] = {}
        total_minutes = 0

        for s in plan_sessions:
            sessions_by_task.setdefault(s.task_id, []).append(s)
            total_minutes += s.duration_minutes
            s_day = _to_date(s.session_date) if s.session_date else date.today()
            daily_minutes_map[s_day] = daily_minutes_map.get(s_day, 0) + s.duration_minutes

        # Credit completed tasks that have no StudySession rows yet (e.g. completed before auto-log)
        for t in all_tasks:
            if t.status == TaskStatus.COMPLETED.value and t.id not in sessions_by_task:
                fallback_hrs = t.actual_duration_hours if (t.actual_duration_hours and t.actual_duration_hours > 0) else t.estimated_duration_hours
                fallback_mins = max(0, int(round((fallback_hrs or 0.0) * 60)))
                total_minutes += fallback_mins
                c_day = _to_date(t.completed_at) if t.completed_at else t.scheduled_date
                if c_day:
                    daily_minutes_map[c_day] = daily_minutes_map.get(c_day, 0) + fallback_mins

        actual_study_hours = round(total_minutes / 60.0, 1)

        # Overall syllabus progress percent
        overall_progress = round((completed_tasks / total_tasks * 100), 1) if total_tasks > 0 else 0.0

        # Module-wise breakdown
        modules_progress = []
        if course:
            for mod in course.modules:
                topic_ids = [t.id for t in mod.topics]
                mod_tasks = [t for t in all_tasks if t.topic_id in topic_ids]
                mod_completed = sum(1 for t in mod_tasks if t.status == TaskStatus.COMPLETED.value)
                mod_rate = round((mod_completed / len(mod_tasks) * 100), 1) if mod_tasks else 0.0
                mod_completed_hrs = sum(t.estimated_duration_hours for t in mod_tasks if t.status == TaskStatus.COMPLETED.value)

                modules_progress.append(
                    ModuleProgress(
                        module_id=mod.id,
                        module_code=mod.module_code,
                        title=mod.title,
                        total_topics=len(mod.topics),
                        completed_topics=mod_completed,
                        completion_rate=mod_rate,
                        total_hours=mod.estimated_hours,
                        completed_hours=round(mod_completed_hrs, 1)
                    )
                )

        # Weekly 7-day breakdown (Mon-Sun for current week)
        today = date.today()
        start_of_week = today - timedelta(days=today.weekday())
        weekly_breakdown = []
        day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

        for i in range(7):
            d = start_of_week + timedelta(days=i)
            day_tasks = [t for t in all_tasks if t.scheduled_date == d]
            p_hrs = sum(t.estimated_duration_hours for t in day_tasks)
            actual_mins = daily_minutes_map.get(d, 0)
            weekly_breakdown.append(
                DailyStudyMetric(
                    day=day_names[i],
                    date_str=d.isoformat(),
                    planned_hours=round(p_hrs, 1),
                    actual_hours=round(actual_mins / 60.0, 1)
                )
            )

        # Streak calculation: consecutive days with study sessions or completed tasks across student's activity
        all_student_sessions = (
            db.query(StudySession)
            .filter(StudySession.student_id == student_id, StudySession.duration_minutes > 0)
            .all()
        )
        active_dates = {_to_date(s.session_date) for s in all_student_sessions if s.session_date}
        for t in all_tasks:
            if t.status == TaskStatus.COMPLETED.value:
                active_dates.add(_to_date(t.completed_at) if t.completed_at else t.scheduled_date)

        streak = 0
        check_date = today
        for _ in range(30):  # check up to 30 days back
            if check_date in active_dates:
                streak += 1
                check_date -= timedelta(days=1)
            elif check_date == today:
                # If no session today yet, check yesterday before breaking streak
                check_date -= timedelta(days=1)
            else:
                break

        days_remaining = max(0, (plan.target_completion_date - today).days)

        return ProgressOverview(
            overall_progress_percent=overall_progress,
            total_syllabus_hours=course.total_learning_hours if course else planned_hours,
            planned_hours=round(planned_hours, 1),
            actual_study_hours=actual_study_hours,
            total_tasks=total_tasks,
            completed_tasks=completed_tasks,
            pending_tasks=pending_tasks,
            missed_tasks=missed_tasks,
            current_streak_days=streak,
            target_completion_date=plan.target_completion_date,
            days_remaining=days_remaining,
            modules_progress=modules_progress,
            weekly_breakdown=weekly_breakdown
        )

