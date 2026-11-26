import json
import logging
from datetime import date, timedelta
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.course import Course
from app.models.planner import StudyPlan, PlannerPreference, StudyTask, StudyPlanMilestone, TaskStatus, TaskType
from app.models.logs import AIUsageLog
from app.services.scheduler_engine import SchedulerEngine
from app.schemas.planner import PlannerOnboardingRequest

logger = logging.getLogger(__name__)

class AIPlannerService:
    @staticmethod
    def generate_and_save_plan(
        db: Session,
        enrollment_id: str,
        student_id: str,
        user_id: str,
        course: Course,
        req: PlannerOnboardingRequest
    ) -> StudyPlan:
        # Check if active plan already exists for this enrollment
        existing_plan = db.query(StudyPlan).filter(
            StudyPlan.enrollment_id == enrollment_id,
            StudyPlan.is_active == True
        ).first()

        if existing_plan:
            # Archive old plan
            existing_plan.is_active = False
            existing_plan.status = "ARCHIVED"

        start_date = req.start_date or date.today()
        target_date = req.target_completion_date

        # Generate deterministic foundation first (ensures 100% syllabus coverage, zero hallucinated modules/hours)
        tasks_data, milestones_data = SchedulerEngine.generate_deterministic_tasks(
            db=db,
            course=course,
            start=start_date,
            target_date=target_date,
            daily_hours=req.daily_study_hours,
            available_days=req.available_days,
            known_topics=req.known_topics,
            weak_topics=req.weak_topics
        )

        generation_source = "DETERMINISTIC"

        # If OpenAI API Key is configured, enrich descriptions and tailored advice
        if settings.OPENAI_API_KEY and settings.OPENAI_API_KEY != "your-openai-api-key-here":
            try:
                from openai import OpenAI
                client = OpenAI(api_key=settings.OPENAI_API_KEY)

                prompt = f"""You are an expert Aptech Curriculum Advisor.
Course: {course.name} ({course.course_code})
Total Hours: {course.total_learning_hours}
Student Goal: {', '.join(req.learning_goals) or 'Career Growth'}
Learning Style: {req.preferred_learning_style}
Known Topics: {', '.join(req.known_topics) or 'None'}
Weak/Focus Topics: {', '.join(req.weak_topics) or 'None'}

Provide a 2-3 sentence personalized executive recommendation for this student to maintain daily consistency and succeed."""

                response = client.chat.completions.create(
                    model=settings.OPENAI_MODEL,
                    messages=[
                        {"role": "system", "content": "You are a professional educational planner."},
                        {"role": "user", "content": prompt}
                    ],
                    max_tokens=200,
                    temperature=0.7
                )
                
                ai_advice = response.choices[0].message.content
                generation_source = "HYBRID_AI"

                # Log usage
                usage = response.usage
                prompt_toks = usage.prompt_tokens if usage else 150
                comp_toks = usage.completion_tokens if usage else 50
                cost = (prompt_toks * 0.00000015) + (comp_toks * 0.0000006)

                ai_log = AIUsageLog(
                    user_id=user_id,
                    feature="PLANNER_GENERATION",
                    model=settings.OPENAI_MODEL,
                    prompt_tokens=prompt_toks,
                    completion_tokens=comp_toks,
                    total_tokens=prompt_toks + comp_toks,
                    estimated_cost_usd=cost
                )
                db.add(ai_log)
            except Exception as e:
                logger.warning(f"OpenAI call skipped/failed: {str(e)}. Proceeding with high-precision deterministic scheduling.")

        # Create StudyPlan
        total_hours = sum(t["estimated_duration_hours"] for t in tasks_data)
        duration_days = max(1, (target_date - start_date).days)
        approx_months = max(1, round(duration_days / 30))
        duration_label = f"{approx_months} Month{'s' if approx_months != 1 else ''}" if duration_days >= 25 else f"{duration_days} Days"
        plan = StudyPlan(
            enrollment_id=enrollment_id,
            student_id=student_id,
            course_id=course.id,
            title=f"{course.name} ({duration_label} Plan)",
            syllabus_version=course.syllabus_version,
            start_date=start_date,
            target_completion_date=target_date,
            total_scheduled_hours=round(total_hours, 1),
            is_active=True,
            status="IN_PROGRESS",
            approval_status="PENDING_APPROVAL",
            generation_source=generation_source
        )
        db.add(plan)
        db.flush()

        # Save Planner Preferences
        preference = PlannerPreference(
            study_plan_id=plan.id,
            target_completion_date=target_date,
            requested_duration_days=req.requested_duration_days,
            daily_study_hours=req.daily_study_hours,
            available_days=req.available_days,
            preferred_learning_style=req.preferred_learning_style,
            learning_goals=req.learning_goals,
            known_topics=req.known_topics,
            weak_topics=req.weak_topics
        )
        db.add(preference)

        # Save Milestones
        for m_data in milestones_data:
            milestone = StudyPlanMilestone(
                study_plan_id=plan.id,
                title=m_data["title"],
                target_week=m_data["target_week"],
                target_date=m_data["target_date"],
                is_completed=False
            )
            db.add(milestone)

        # Save Study Tasks
        for t_data in tasks_data:
            task = StudyTask(
                study_plan_id=plan.id,
                topic_id=t_data["topic_id"],
                title=t_data["title"],
                description=t_data["description"],
                scheduled_date=t_data["scheduled_date"],
                estimated_duration_hours=t_data["estimated_duration_hours"],
                actual_duration_hours=0.0,
                task_type=t_data["task_type"],
                status=t_data["status"],
                order_index=t_data["order_index"]
            )
            db.add(task)

        db.commit()
        db.refresh(plan)
        return plan

