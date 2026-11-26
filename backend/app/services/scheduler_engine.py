import math
import logging
from datetime import date, timedelta
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from app.models.course import Course, CourseModule, CourseTopic
from app.models.planner import StudyPlan, StudyPlanVersion, StudyTask, StudyPlanMilestone, TaskStatus, TaskType
from app.schemas.planner import PlannerOnboardingRequest, CapacityFeasibilityResponse

logger = logging.getLogger(__name__)

DAY_MAP = {
    0: "MON",
    1: "TUE",
    2: "WED",
    3: "THU",
    4: "FRI",
    5: "SAT",
    6: "SUN"
}

class SchedulerEngine:
    @staticmethod
    def get_available_study_dates(start: date, end: date, available_days: List[str]) -> List[date]:
        allowed_days_set = {d.upper() for d in available_days}
        curr = start
        valid_dates = []
        while curr <= end:
            day_name = DAY_MAP[curr.weekday()]
            if day_name in allowed_days_set:
                valid_dates.append(curr)
            curr += timedelta(days=1)
        return valid_dates

    @staticmethod
    def calculate_capacity_feasibility(
        course_hours: float,
        start: date,
        target_date: date,
        daily_hours: float,
        available_days: List[str]
    ) -> CapacityFeasibilityResponse:
        available_dates = SchedulerEngine.get_available_study_dates(start, target_date, available_days)
        total_available_slots = len(available_dates)
        total_capacity_hours = total_available_slots * daily_hours

        # Need at least total_syllabus_hours
        recommended_slots_needed = math.ceil(course_hours / daily_hours) if daily_hours > 0 else 999
        capacity_ratio = round(total_capacity_hours / course_hours, 2) if course_hours > 0 else 1.0

        is_feasible = total_capacity_hours >= course_hours
        warnings = []
        suggestions = []

        if not is_feasible:
            deficit = round(course_hours - total_capacity_hours, 1)
            warnings.append(
                f"Deficit of {deficit} hours! Available capacity ({total_capacity_hours} hrs) is insufficient for this {course_hours} hrs syllabus."
            )
            # Alternatives:
            # 1. Increase daily hours
            req_daily = round(course_hours / total_available_slots, 1) if total_available_slots > 0 else 0
            suggestions.append(f"Option A: Increase daily study time to at least {req_daily} hours/day.")
            
            # 2. Add more days per week
            if len(available_days) < 7:
                suggestions.append("Option B: Enable more study days per week (e.g. weekends).")
            
            # 3. Extend target duration (without prescribing a specific recommended date)
            suggestions.append("Option C: Increase your total study duration (e.g., choose more months).")
        elif capacity_ratio < 1.15:
            warnings.append("Tight schedule: Buffer for revisions or unexpected interruptions is less than 15%.")
            suggestions.append("Consider adding 1-2 buffer weeks to accommodate difficult topics and projects.")
        else:
            suggestions.append("Schedule is well-balanced with sufficient revision and project buffer.")

        return CapacityFeasibilityResponse(
            is_feasible=is_feasible,
            total_syllabus_hours=round(course_hours, 1),
            total_available_hours=round(total_capacity_hours, 1),
            capacity_ratio=capacity_ratio,
            recommended_min_days=recommended_slots_needed,
            warnings=warnings,
            suggestions=suggestions
        )

    @staticmethod
    def generate_deterministic_tasks(
        db: Session,
        course: Course,
        start: date,
        target_date: date,
        daily_hours: float,
        available_days: List[str],
        known_topics: List[str] = None,
        weak_topics: List[str] = None
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Distributes syllabus topics deterministically across available study dates.
        Returns: (tasks_data, milestones_data)
        """
        known_set = set(known_topics or [])
        weak_set = set(weak_topics or [])
        available_dates = SchedulerEngine.get_available_study_dates(start, target_date, available_days)

        if not available_dates:
            # Fallback to daily dates if no matching days selected
            available_dates = [start + timedelta(days=i) for i in range((target_date - start).days + 1)]

        date_idx = 0
        total_dates = len(available_dates)
        tasks = []
        milestones = []

        current_day_allocated_hours = 0.0
        current_date = available_dates[0]

        # Fetch modules and topics in strict order
        modules = sorted(course.modules, key=lambda m: m.order_index)
        all_topics = []
        for m in modules:
            topics = sorted(m.topics, key=lambda t: t.order_index)
            for t in topics:
                all_topics.append((m, t))

        task_order = 1
        current_week = 1
        week_start_date = start

        for mod, top in all_topics:
            hours = top.estimated_hours
            if top.topic_code in known_set:
                # Fast track if student already knows topic
                hours = max(2.0, hours * 0.5)
            elif top.topic_code in weak_set:
                # Give 20% extra time for flagged difficult topics
                hours = hours * 1.2

            # Break large topics into chunks fitting within daily study limit
            remaining_topic_hours = hours
            chunk_num = 1
            total_chunks = max(1, math.ceil(hours / daily_hours))

            while remaining_topic_hours > 0:
                slot_capacity = daily_hours - current_day_allocated_hours
                if slot_capacity <= 0.5:
                    # Move to next available study date
                    date_idx += 1
                    if date_idx < total_dates:
                        current_date = available_dates[date_idx]
                    else:
                        # Append forward
                        current_date = current_date + timedelta(days=1)
                    current_day_allocated_hours = 0.0
                    slot_capacity = daily_hours

                chunk_hours = min(remaining_topic_hours, slot_capacity)
                remaining_topic_hours -= chunk_hours
                current_day_allocated_hours += chunk_hours

                title = f"{top.title}" if total_chunks == 1 else f"{top.title} (Part {chunk_num}/{total_chunks})"
                tasks.append({
                    "topic_id": top.id,
                    "topic_code": top.topic_code,
                    "title": title,
                    "description": top.description or f"Complete official curriculum for {top.title}",
                    "scheduled_date": current_date,
                    "estimated_duration_hours": round(chunk_hours, 1),
                    "task_type": TaskType.TOPIC.value,
                    "status": TaskStatus.NOT_STARTED.value,
                    "order_index": task_order
                })
                task_order += 1
                chunk_num += 1

            # Insert a practice exercise task after each topic
            date_idx += 1
            if date_idx < total_dates:
                current_date = available_dates[date_idx]
            else:
                current_date = current_date + timedelta(days=1)
            current_day_allocated_hours = min(daily_hours, 2.0)

            is_economics = any(k in (course.name or "").lower() for k in ["economic", "ap micro", "ap macro", "ap-econ"])
            practice_title = f"Practice & Problem Set (FRQ): {top.title}" if is_economics else f"Hands-on Lab & Practice: {top.title}"
            practice_desc = (
                f"Solve AP-style multiple-choice questions, Free-Response Questions (FRQ), and graphical analysis for {top.title}."
                if is_economics
                else f"Complete hands-on coding exercises and laboratory assignments for {top.title}."
            )

            tasks.append({
                "topic_id": top.id,
                "topic_code": top.topic_code,
                "title": practice_title,
                "description": practice_desc,
                "scheduled_date": current_date,
                "estimated_duration_hours": round(current_day_allocated_hours, 1),
                "task_type": TaskType.PRACTICE.value,
                "status": TaskStatus.NOT_STARTED.value,
                "order_index": task_order
            })
            task_order += 1

        # Add Module Milestone & Revision for each module
        module_week = 1
        for m in modules:
            m_date = start + timedelta(weeks=module_week * 2)
            if m_date > target_date:
                m_date = target_date
            milestones.append({
                "title": f"Milestone: Complete {m.title}",
                "target_week": module_week * 2,
                "target_date": m_date,
                "is_completed": False
            })
            module_week += 1

        # Add Capstone Milestone at the end
        milestones.append({
            "title": f"Final Course Completion: {course.name}",
            "target_week": max(module_week * 2, 4),
            "target_date": target_date,
            "is_completed": False
        })

        return tasks, milestones

    @staticmethod
    def reschedule_missed_tasks(db: Session, study_plan_id: str, available_days: List[str]) -> Dict[str, Any]:
        """
        Dynamically shifts MISSED and overdue uncompleted tasks to upcoming open dates
        without modifying or overwriting already COMPLETED tasks.
        """
        plan = db.query(StudyPlan).filter(StudyPlan.id == study_plan_id).first()
        if not plan:
            return {"rescheduled_count": 0, "message": "Plan not found"}

        today = date.today()
        # Find all uncompleted tasks that are overdue
        overdue_tasks = (
            db.query(StudyTask)
            .filter(
                StudyTask.study_plan_id == study_plan_id,
                StudyTask.scheduled_date < today,
                StudyTask.status.in_([TaskStatus.NOT_STARTED.value, TaskStatus.IN_PROGRESS.value, TaskStatus.MISSED.value])
            )
            .order_by(StudyTask.scheduled_date, StudyTask.order_index)
            .all()
        )

        if not overdue_tasks:
            return {"rescheduled_count": 0, "message": "No overdue tasks need rescheduling."}

        # Available future dates starting from tomorrow or today
        allowed_days_set = {d.upper() for d in available_days} if available_days else set(DAY_MAP.values())
        next_date = today
        rescheduled_count = 0

        for task in overdue_tasks:
            task.status = TaskStatus.RESCHEDULED.value
            
            # Find next valid day
            while True:
                day_name = DAY_MAP[next_date.weekday()]
                if day_name in allowed_days_set:
                    break
                next_date += timedelta(days=1)

            task.scheduled_date = next_date
            rescheduled_count += 1
            next_date += timedelta(days=1)

        db.commit()
        return {
            "rescheduled_count": rescheduled_count,
            "message": f"Successfully rescheduled {rescheduled_count} missed tasks to upcoming available study slots."
        }

    @staticmethod
    def redistribute_remaining_tasks(
        db: Session,
        study_plan_id: str,
        new_available_days: List[str],
        new_daily_hours: float = None,
        new_target_date: date = None
    ) -> Dict[str, Any]:
        """
        Dynamically shifts all uncompleted tasks to new study dates starting from TODAY,
        without modifying or overwriting already COMPLETED tasks.
        """
        plan = db.query(StudyPlan).filter(StudyPlan.id == study_plan_id).first()
        if not plan:
            return {"success": False, "message": "Study plan not found."}

        # Update preferences
        if plan.preference:
            plan.preference.available_days = [d.upper() for d in new_available_days]
            if new_daily_hours:
                plan.preference.daily_study_hours = new_daily_hours
            if new_target_date:
                plan.preference.target_completion_date = new_target_date

        today = date.today()
        daily_hours = new_daily_hours or (plan.preference.daily_study_hours if plan.preference else 2.0)
        allowed_days_set = {d.upper() for d in new_available_days}
        if not allowed_days_set:
            allowed_days_set = set(DAY_MAP.values())

        # Get all incomplete tasks ordered by order_index
        incomplete_tasks = (
            db.query(StudyTask)
            .filter(
                StudyTask.study_plan_id == study_plan_id,
                StudyTask.status != TaskStatus.COMPLETED.value
            )
            .order_by(StudyTask.order_index, StudyTask.scheduled_date)
            .all()
        )

        if not incomplete_tasks:
            return {"success": True, "rescheduled_count": 0, "message": "All topics in this plan are already completed!"}

        # Compute starting order_index after completed tasks so ordering stays contiguous
        max_completed_order = (
            db.query(StudyTask)
            .filter(
                StudyTask.study_plan_id == study_plan_id,
                StudyTask.status == TaskStatus.COMPLETED.value
            )
            .count()
        )

        # Determine whether to spread remaining hours evenly across the target date window
        remaining_hours = round(sum((t.estimated_duration_hours or 0.0) for t in incomplete_tasks), 2)
        effective_target = new_target_date or plan.target_completion_date
        available_dates = SchedulerEngine.get_available_study_dates(
            today,
            max(today, effective_target),
            list(allowed_days_set),
        )

        use_even_spread = False
        even_pace = daily_hours
        slot_hours = daily_hours

        if new_target_date and new_target_date > today and len(available_dates) > 0 and remaining_hours > 0:
            even_pace = remaining_hours / len(available_dates)
            if even_pace <= daily_hours + 0.01:
                use_even_spread = True
                slot_hours = max(0.5, min(daily_hours, round(even_pace * 4) / 4))

        # Step 1: Merge consecutive untouched NOT_STARTED tasks belonging to the same (topic_id, task_type)
        # so multi-part chunks cleanly re-split to the new daily chunk size (e.g. 4h -> 4 x 1h days)
        consolidated_tasks: List[StudyTask] = []
        for task in incomplete_tasks:
            is_untouched = (
                task.status in (TaskStatus.NOT_STARTED.value, TaskStatus.MISSED.value, TaskStatus.RESCHEDULED.value)
                and (task.actual_duration_hours or 0.0) == 0.0
            )
            if (
                is_untouched
                and task.topic_id is not None
                and consolidated_tasks
                and consolidated_tasks[-1].topic_id == task.topic_id
                and consolidated_tasks[-1].task_type == task.task_type
                and consolidated_tasks[-1].status in (TaskStatus.NOT_STARTED.value, TaskStatus.MISSED.value, TaskStatus.RESCHEDULED.value)
                and (consolidated_tasks[-1].actual_duration_hours or 0.0) == 0.0
            ):
                prev = consolidated_tasks[-1]
                prev.estimated_duration_hours = round((prev.estimated_duration_hours or 0.0) + (task.estimated_duration_hours or 0.0), 2)
                prev.title = prev.title.split(" (Part ")[0]
                db.delete(task)
            else:
                consolidated_tasks.append(task)

        db.flush()

        # Step 2: Split untouched tasks whose duration exceeds slot_hours (e.g. 4h topic at 1h/day -> 4 days)
        normalized_tasks: List[StudyTask] = []
        for task in consolidated_tasks:
            task_hrs = task.estimated_duration_hours or 2.0
            can_split = (
                task.status in (TaskStatus.NOT_STARTED.value, TaskStatus.MISSED.value, TaskStatus.RESCHEDULED.value)
                and (task.actual_duration_hours or 0.0) == 0.0
                and slot_hours > 0
                and task_hrs > slot_hours + 0.01
            )
            if not can_split:
                normalized_tasks.append(task)
            else:
                remaining_task_hrs = task_hrs
                part_num = 1
                total_parts = max(1, math.ceil((task_hrs - 0.01) / slot_hours))
                base_title = task.title.split(" (Part ")[0]
                is_first = True
                while remaining_task_hrs > 0.01:
                    chunk_hrs = round(min(slot_hours, remaining_task_hrs), 2)
                    part_title = f"{base_title} (Part {part_num}/{total_parts})" if total_parts > 1 else base_title
                    if is_first:
                        task.title = part_title
                        task.estimated_duration_hours = chunk_hrs
                        normalized_tasks.append(task)
                        is_first = False
                    else:
                        new_chunk = StudyTask(
                            study_plan_id=task.study_plan_id,
                            topic_id=task.topic_id,
                            title=part_title,
                            description=task.description,
                            task_type=task.task_type,
                            scheduled_date=today,
                            estimated_duration_hours=chunk_hrs,
                            actual_duration_hours=0.0,
                            status=TaskStatus.NOT_STARTED.value,
                            order_index=0,
                        )
                        db.add(new_chunk)
                        normalized_tasks.append(new_chunk)
                    remaining_task_hrs = round(remaining_task_hrs - chunk_hrs, 2)
                    part_num += 1

        rescheduled_count = 0
        curr_date = today

        if use_even_spread:
            total_avail_days = len(available_dates)
            day_hours = [0.0] * total_avail_days
            cum_hours = 0.0

            for idx, task in enumerate(normalized_tasks):
                task_hrs = task.estimated_duration_hours or 2.0
                d_idx = min(total_avail_days - 1, int(cum_hours / max(even_pace, 0.01)))
                while (
                    d_idx < total_avail_days - 1
                    and day_hours[d_idx] > 0
                    and day_hours[d_idx] + task_hrs > daily_hours + 0.01
                ):
                    d_idx += 1

                assigned_date = available_dates[d_idx]
                task.scheduled_date = assigned_date
                task.order_index = max_completed_order + idx
                if task.status == TaskStatus.MISSED.value:
                    task.status = TaskStatus.NOT_STARTED.value
                day_hours[d_idx] += task_hrs
                cum_hours += task_hrs
                curr_date = max(curr_date, assigned_date)
                rescheduled_count += 1

            plan.target_completion_date = max(effective_target, curr_date)
        else:
            # Standard pack from today at up to daily_hours per allowed day
            while DAY_MAP[curr_date.weekday()] not in allowed_days_set:
                curr_date += timedelta(days=1)

            day_hours_accum = 0.0
            for idx, task in enumerate(normalized_tasks):
                task_hrs = task.estimated_duration_hours or 2.0
                if day_hours_accum + task_hrs > daily_hours + 0.01 and day_hours_accum > 0:
                    curr_date += timedelta(days=1)
                    while DAY_MAP[curr_date.weekday()] not in allowed_days_set:
                        curr_date += timedelta(days=1)
                    day_hours_accum = 0.0

                task.scheduled_date = curr_date
                task.order_index = max_completed_order + idx
                if task.status == TaskStatus.MISSED.value:
                    task.status = TaskStatus.NOT_STARTED.value
                day_hours_accum += task_hrs
                rescheduled_count += 1

            if new_target_date:
                plan.target_completion_date = max(new_target_date, curr_date)
            elif curr_date > plan.target_completion_date:
                plan.target_completion_date = curr_date

        # Update plan title duration label if target completion date changed
        if new_target_date and plan.course:
            duration_days = max(1, (plan.target_completion_date - plan.start_date).days)
            approx_months = max(1, round(duration_days / 30))
            duration_label = f"{approx_months} Month{'s' if approx_months != 1 else ''}" if duration_days >= 25 else f"{duration_days} Days"
            plan.title = f"{plan.course.name} ({duration_label} Plan)"

        db.commit()
        return {
            "success": True,
            "rescheduled_count": rescheduled_count,
            "effective_daily_hours": round(slot_hours, 2),
            "new_target_completion_date": plan.target_completion_date.isoformat(),
            "message": f"Successfully distributed {rescheduled_count} remaining tasks evenly up to {plan.target_completion_date.isoformat()}."
        }

    @staticmethod
    def estimate_remaining_finish_date(
        incomplete_tasks: List[StudyTask],
        new_available_days: List[str],
        new_daily_hours: float,
        start_from: date = None,
    ) -> date:
        """Simulates when remaining uncompleted tasks would finish under new days & daily hours."""
        today = start_from or date.today()
        allowed_days_set = {d.upper() for d in new_available_days} or set(DAY_MAP.values())
        daily_hours = new_daily_hours or 2.0

        curr_date = today
        while DAY_MAP[curr_date.weekday()] not in allowed_days_set:
            curr_date += timedelta(days=1)

        if not incomplete_tasks:
            return curr_date

        day_hours_accum = 0.0
        for task in incomplete_tasks:
            rem_hrs = task.estimated_duration_hours or 2.0
            can_split = (
                task.status in (TaskStatus.NOT_STARTED.value, TaskStatus.MISSED.value, TaskStatus.RESCHEDULED.value)
                and (task.actual_duration_hours or 0.0) == 0.0
                and daily_hours > 0
                and rem_hrs > daily_hours + 0.01
            )
            chunks = []
            if can_split:
                r = rem_hrs
                while r > 0.01:
                    c = round(min(daily_hours, r), 2)
                    chunks.append(c)
                    r = round(r - c, 2)
            else:
                chunks = [rem_hrs]

            for chunk_hrs in chunks:
                if day_hours_accum + chunk_hrs > daily_hours + 0.01 and day_hours_accum > 0:
                    curr_date += timedelta(days=1)
                    while DAY_MAP[curr_date.weekday()] not in allowed_days_set:
                        curr_date += timedelta(days=1)
                    day_hours_accum = 0.0
                day_hours_accum += chunk_hrs

        return curr_date

    @staticmethod
    def create_plan_version_snapshot(
        db: Session,
        plan: StudyPlan,
        archived_reason: str,
        approved_by: str = None,
    ) -> StudyPlanVersion:
        """Saves an immutable snapshot of the current StudyPlan state before applying an approved edit."""
        pref = plan.preference
        daily_hours = pref.daily_study_hours if pref else 2.0
        available_days = list(pref.available_days) if (pref and pref.available_days) else ["MON", "TUE", "WED", "THU", "FRI", "SAT"]

        sorted_tasks = sorted(plan.tasks, key=lambda x: (x.scheduled_date, x.order_index))
        snapshot_tasks = [
            {
                "id": t.id,
                "title": t.title,
                "topic_code": t.topic.topic_code if t.topic else None,
                "task_type": t.task_type,
                "scheduled_date": t.scheduled_date.isoformat() if t.scheduled_date else None,
                "estimated_duration_hours": t.estimated_duration_hours,
                "actual_duration_hours": t.actual_duration_hours,
                "status": t.status,
                "completed_at": t.completed_at.isoformat() if t.completed_at else None,
            }
            for t in sorted_tasks
        ]
        snapshot_milestones = [
            {
                "id": m.id,
                "title": m.title,
                "target_week": m.target_week,
                "target_date": m.target_date.isoformat() if m.target_date else None,
                "is_completed": m.is_completed,
            }
            for m in sorted(plan.milestones, key=lambda x: x.target_week)
        ]

        version_row = StudyPlanVersion(
            study_plan_id=plan.id,
            version_number=getattr(plan, "version_number", 1) or 1,
            title=plan.title,
            start_date=plan.start_date,
            target_completion_date=plan.target_completion_date,
            daily_study_hours=daily_hours,
            available_days=available_days,
            total_scheduled_hours=plan.total_scheduled_hours,
            total_tasks=len(sorted_tasks),
            completed_tasks=sum(1 for t in sorted_tasks if t.status == TaskStatus.COMPLETED.value),
            archived_reason=archived_reason,
            approved_by=approved_by,
            snapshot_tasks=snapshot_tasks,
            snapshot_milestones=snapshot_milestones,
        )
        db.add(version_row)
        db.flush()
        return version_row


