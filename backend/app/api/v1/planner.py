import csv
import io
import math
from datetime import date, datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User, StudentProfile
from app.models.course import Course
from app.models.enrollment import Enrollment, EnrollmentStatus, AccessType
from app.models.planner import StudyPlan, StudyPlanVersion, StudyTask, TaskStatus
from app.schemas.planner import (
    PlannerOnboardingRequest,
    PlannerAdjustRequest,
    CapacityFeasibilityResponse,
    StudyPlanResponse,
    StudyPlanDetailResponse,
    StudyPlanVersionResponse,
    MilestoneSchema,
    TaskResponse
)
from app.schemas.task import RescheduleRequest
from app.services.scheduler_engine import SchedulerEngine
from app.services.ai_planner_service import AIPlannerService
from app.api.deps import require_student, get_current_user

router = APIRouter(prefix="/plans", tags=["Study Planner"])


def get_trial_unlocked_limit(plan: StudyPlan) -> Optional[int]:
    """Returns max number of unlocked tasks (20%) for TRIAL enrollments, or None for FULL access."""
    if plan.enrollment and getattr(plan.enrollment, "access_type", AccessType.FULL.value) == AccessType.TRIAL.value:
        total = len(plan.tasks)
        return max(1, math.ceil(total * 0.20)) if total > 0 else 0
    return None


def get_unlocked_task_ids(plan: StudyPlan) -> Optional[set]:
    limit = get_trial_unlocked_limit(plan)
    if limit is None:
        return None
    sorted_tasks = sorted(plan.tasks, key=lambda t: (t.scheduled_date, t.order_index, t.id))
    return {t.id for t in sorted_tasks[:limit]}


def serialize_study_plan(plan: StudyPlan, include_tasks: bool = False, apply_trial_mask: bool = True):
    pref = plan.preference
    daily_hours = pref.daily_study_hours if pref else 2.0
    available_days = list(pref.available_days) if (pref and pref.available_days) else ["MON", "TUE", "WED", "THU", "FRI", "SAT"]

    access_type = (
        getattr(plan.enrollment, "access_type", AccessType.FULL.value)
        if plan.enrollment else AccessType.FULL.value
    )
    unlocked_limit = get_trial_unlocked_limit(plan) if apply_trial_mask else None
    unlocked_ids = get_unlocked_task_ids(plan) if apply_trial_mask else None

    completed_count = sum(1 for t in plan.tasks if t.status == TaskStatus.COMPLETED.value)
    remaining_hours = round(
        sum((t.estimated_duration_hours or 0.0) for t in plan.tasks if t.status != TaskStatus.COMPLETED.value),
        2
    )
    feasibility_hours = remaining_hours if completed_count > 0 else (plan.course.total_learning_hours if plan.course else plan.total_scheduled_hours)
    feasibility_start = max(date.today(), plan.start_date) if completed_count > 0 else plan.start_date

    feasibility = SchedulerEngine.calculate_capacity_feasibility(
        course_hours=feasibility_hours,
        start=feasibility_start,
        target_date=max(plan.target_completion_date, feasibility_start),
        daily_hours=daily_hours,
        available_days=available_days,
    )

    milestones_schemas = [
        MilestoneSchema(
            id=m.id,
            title=m.title,
            target_week=m.target_week,
            target_date=m.target_date,
            is_completed=m.is_completed
        )
        for m in plan.milestones
    ]

    common_kwargs = dict(
        id=plan.id,
        enrollment_id=plan.enrollment_id,
        student_id=plan.student_id,
        course_id=plan.course_id,
        course_name=plan.course.name,
        course_code=plan.course.course_code,
        title=plan.title,
        syllabus_version=plan.syllabus_version,
        start_date=plan.start_date,
        target_completion_date=plan.target_completion_date,
        total_scheduled_hours=plan.total_scheduled_hours,
        is_active=plan.is_active,
        status=plan.status,
        access_type=access_type,
        unlocked_tasks_count=unlocked_limit if unlocked_limit is not None else len(plan.tasks),
        approval_status=getattr(plan, "approval_status", "APPROVED") or "APPROVED",
        admin_review_note=getattr(plan, "admin_review_note", None),
        reviewed_at=getattr(plan, "reviewed_at", None),
        daily_study_hours=daily_hours,
        available_days=available_days,
        feasibility=feasibility,
        generation_source=plan.generation_source,
        total_tasks=len(plan.tasks),
        completed_tasks=completed_count,
        version_number=getattr(plan, "version_number", 1) or 1,
        has_pending_edit=bool(getattr(plan, "has_pending_edit", False)),
        pending_edit_data=getattr(plan, "pending_edit_data", None),
        versions_count=len(getattr(plan, "versions", []) or []),
        milestones=milestones_schemas,
        created_at=plan.created_at,
    )

    if not include_tasks:
        return StudyPlanResponse(**common_kwargs)

    tasks_schemas = []
    for t in plan.tasks:
        is_locked = unlocked_ids is not None and t.id not in unlocked_ids
        tasks_schemas.append(
            TaskResponse(
                id=t.id,
                study_plan_id=t.study_plan_id,
                topic_id=None if is_locked else t.topic_id,
                topic_code=None if is_locked else (t.topic.topic_code if t.topic else None),
                title="Locked Class — Enroll to Unlock Full Access" if is_locked else t.title,
                description=None if is_locked else t.description,
                scheduled_date=t.scheduled_date,
                estimated_duration_hours=t.estimated_duration_hours,
                actual_duration_hours=t.actual_duration_hours,
                task_type=t.task_type,
                status=t.status,
                completed_at=t.completed_at,
                order_index=t.order_index,
                personal_notes=None if is_locked else t.personal_notes,
                is_locked=is_locked,
            )
        )
    return StudyPlanDetailResponse(**common_kwargs, tasks=tasks_schemas)

@router.post("/preview", response_model=CapacityFeasibilityResponse)
def preview_plan_feasibility(
    payload: PlannerOnboardingRequest,
    student: StudentProfile = Depends(require_student),
    db: Session = Depends(get_db)
):
    enrollment = db.query(Enrollment).filter(
        Enrollment.id == payload.enrollment_id,
        Enrollment.student_id == student.id
    ).first()

    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found.")

    if enrollment.status != EnrollmentStatus.ACTIVE.value:
        raise HTTPException(status_code=403, detail="Only approved and ACTIVE enrollments can configure a study planner.")

    course = enrollment.course
    start = payload.start_date or date.today()
    if payload.target_completion_date <= start:
        raise HTTPException(
            status_code=400,
            detail="Target completion date must be after the start date."
        )

    feasibility = SchedulerEngine.calculate_capacity_feasibility(
        course_hours=course.total_learning_hours,
        start=start,
        target_date=payload.target_completion_date,
        daily_hours=payload.daily_study_hours,
        available_days=payload.available_days
    )
    return feasibility

@router.post("/generate", response_model=StudyPlanResponse)
def generate_study_plan(
    payload: PlannerOnboardingRequest,
    student: StudentProfile = Depends(require_student),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    enrollment = db.query(Enrollment).filter(
        Enrollment.id == payload.enrollment_id,
        Enrollment.student_id == student.id
    ).first()

    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found or does not belong to you.")

    if enrollment.status != EnrollmentStatus.ACTIVE.value:
        raise HTTPException(status_code=403, detail="Enrollment is not ACTIVE. Cannot generate planner.")

    start = payload.start_date or date.today()
    if payload.target_completion_date <= start:
        raise HTTPException(
            status_code=400,
            detail="Target completion date must be after the start date."
        )

    plan = AIPlannerService.generate_and_save_plan(
        db=db,
        enrollment_id=enrollment.id,
        student_id=student.id,
        user_id=current_user.id,
        course=enrollment.course,
        req=payload
    )

    # Free Trial plans auto-approve so students can immediately preview their 20% schedule
    if getattr(enrollment, "access_type", AccessType.FULL.value) == AccessType.TRIAL.value:
        plan.approval_status = "APPROVED"
        plan.admin_review_note = "Auto-approved for 20% Free Trial Preview"
        db.commit()
        db.refresh(plan)

    return serialize_study_plan(plan, include_tasks=False)

@router.get("/current", response_model=Optional[StudyPlanResponse])
def get_current_active_plan(
    student: StudentProfile = Depends(require_student),
    db: Session = Depends(get_db)
):
    plan = (
        db.query(StudyPlan)
        .filter(StudyPlan.student_id == student.id, StudyPlan.is_active == True)
        .order_by(StudyPlan.created_at.desc())
        .first()
    )

    if not plan:
        return None

    return serialize_study_plan(plan, include_tasks=False)

@router.get("/{id}", response_model=StudyPlanDetailResponse)
def get_plan_detail(
    id: str,
    student: StudentProfile = Depends(require_student),
    db: Session = Depends(get_db)
):
    plan = db.query(StudyPlan).filter(StudyPlan.id == id, StudyPlan.student_id == student.id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Study plan not found.")

    return serialize_study_plan(plan, include_tasks=True)

@router.post("/{id}/reschedule")
def reschedule_plan_tasks(
    id: str,
    payload: Optional[RescheduleRequest] = None,
    student: StudentProfile = Depends(require_student),
    db: Session = Depends(get_db)
):
    plan = db.query(StudyPlan).filter(StudyPlan.id == id, StudyPlan.student_id == student.id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Study plan not found.")

    available_days = plan.preference.available_days if plan.preference else ["MON", "TUE", "WED", "THU", "FRI", "SAT"]
    result = SchedulerEngine.reschedule_missed_tasks(db, plan.id, available_days)
    return result

@router.patch("/{id}/adjust")
def adjust_plan_schedule(
    id: str,
    payload: PlannerAdjustRequest,
    student: StudentProfile = Depends(require_student),
    db: Session = Depends(get_db)
):
    plan = db.query(StudyPlan).filter(StudyPlan.id == id, StudyPlan.student_id == student.id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Study plan not found.")

    incomplete_tasks = (
        db.query(StudyTask)
        .filter(
            StudyTask.study_plan_id == plan.id,
            StudyTask.status != TaskStatus.COMPLETED.value
        )
        .order_by(StudyTask.order_index, StudyTask.scheduled_date)
        .all()
    )
    if not incomplete_tasks:
        raise HTTPException(status_code=400, detail="All topics in this plan are already completed. Nothing left to reschedule.")

    req_days = [d.upper() for d in payload.available_days] if payload.available_days else ["MON", "TUE", "WED", "THU", "FRI", "SAT"]
    req_daily_hours = payload.daily_study_hours or (plan.preference.daily_study_hours if plan.preference else 2.0)
    req_target_date = payload.target_completion_date or plan.target_completion_date

    # If the plan is already APPROVED, do NOT modify the live schedule yet — send the edit request to Admin!
    if plan.approval_status == "APPROVED":
        remaining_hours = round(sum((t.estimated_duration_hours or 0.0) for t in incomplete_tasks), 2)
        completed_count = sum(1 for t in plan.tasks if t.status == TaskStatus.COMPLETED.value)
        est_finish = SchedulerEngine.estimate_remaining_finish_date(
            incomplete_tasks=incomplete_tasks,
            new_available_days=req_days,
            new_daily_hours=req_daily_hours,
            start_from=date.today(),
        )
        effective_target = max(req_target_date, date.today())
        feasibility = SchedulerEngine.calculate_capacity_feasibility(
            course_hours=remaining_hours,
            start=date.today(),
            target_date=effective_target,
            daily_hours=req_daily_hours,
            available_days=req_days,
        )

        # Always assign a fresh dict so SQLAlchemy detects JSON column mutation
        plan.has_pending_edit = True
        plan.pending_edit_data = {
            "requested_at": datetime.now(timezone.utc).isoformat(),
            "available_days": req_days,
            "daily_study_hours": req_daily_hours,
            "target_completion_date": req_target_date.isoformat() if req_target_date else None,
            "estimated_finish_date": est_finish.isoformat(),
            "remaining_hours": remaining_hours,
            "remaining_tasks_count": len(incomplete_tasks),
            "completed_tasks_count": completed_count,
            "edit_status": "PENDING_APPROVAL",
            "admin_feedback": None,
            "feasibility": feasibility.model_dump(),
        }
        db.commit()
        db.refresh(plan)
        return {
            "success": True,
            "pending_approval": True,
            "message": "Edit request sent to Admin for approval! Your current approved schedule stays active until Admin approves.",
            "pending_edit_data": plan.pending_edit_data,
        }

    # If the initial plan has NOT been approved yet (e.g. PENDING_APPROVAL or CHANGES_REQUESTED), update uncompleted tasks directly
    result = SchedulerEngine.redistribute_remaining_tasks(
        db=db,
        study_plan_id=plan.id,
        new_available_days=req_days,
        new_daily_hours=req_daily_hours,
        new_target_date=req_target_date
    )

    db.refresh(plan)
    if plan.approval_status == "CHANGES_REQUESTED":
        plan.approval_status = "PENDING_APPROVAL"
        plan.admin_review_note = None
        db.commit()

    return {**result, "pending_approval": False}


@router.delete("/{id}/pending-edit")
def cancel_pending_plan_edit(
    id: str,
    student: StudentProfile = Depends(require_student),
    db: Session = Depends(get_db)
):
    """Allows a student to withdraw their unapproved plan edit request."""
    plan = db.query(StudyPlan).filter(StudyPlan.id == id, StudyPlan.student_id == student.id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Study plan not found.")
    if not plan.has_pending_edit:
        return {"success": True, "message": "No pending edit request to cancel."}

    plan.has_pending_edit = False
    plan.pending_edit_data = None
    db.commit()
    return {"success": True, "message": "Pending edit request cancelled. Your approved schedule remains active."}


@router.get("/{id}/history", response_model=List[StudyPlanVersionResponse])
def get_plan_version_history(
    id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns all saved old versions (before approved edits) and archived previous plans for future reference by Student & Admin."""
    plan = db.query(StudyPlan).filter(StudyPlan.id == id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Study plan not found.")

    if current_user.role != "ADMIN":
        if not current_user.student_profile or plan.student_id != current_user.student_profile.id:
            raise HTTPException(status_code=403, detail="Access denied to view this plan's history.")

    history_items: List[StudyPlanVersionResponse] = []

    # 1. Immutable snapshots saved before approved edits
    versions = (
        db.query(StudyPlanVersion)
        .filter(StudyPlanVersion.study_plan_id == plan.id)
        .order_by(StudyPlanVersion.version_number.desc(), StudyPlanVersion.created_at.desc())
        .all()
    )
    for v in versions:
        history_items.append(
            StudyPlanVersionResponse(
                id=v.id,
                study_plan_id=v.study_plan_id,
                source_type="VERSION_SNAPSHOT",
                version_number=v.version_number,
                title=v.title,
                start_date=v.start_date,
                target_completion_date=v.target_completion_date,
                daily_study_hours=v.daily_study_hours,
                available_days=list(v.available_days or []),
                total_scheduled_hours=v.total_scheduled_hours,
                total_tasks=v.total_tasks,
                completed_tasks=v.completed_tasks,
                archived_reason=v.archived_reason,
                created_at=v.created_at,
                snapshot_tasks=list(v.snapshot_tasks or []),
                snapshot_milestones=list(v.snapshot_milestones or []),
            )
        )

    # 2. Any previously ARCHIVED plans on the same enrollment (from onboarding wizard re-generation)
    archived_plans = (
        db.query(StudyPlan)
        .filter(
            StudyPlan.enrollment_id == plan.enrollment_id,
            StudyPlan.id != plan.id,
            StudyPlan.status == "ARCHIVED"
        )
        .order_by(StudyPlan.created_at.desc())
        .all()
    )
    for ap in archived_plans:
        ap_pref = ap.preference
        ap_tasks = sorted(ap.tasks, key=lambda x: (x.scheduled_date, x.order_index))
        history_items.append(
            StudyPlanVersionResponse(
                id=ap.id,
                study_plan_id=ap.id,
                source_type="ARCHIVED_PLAN",
                version_number=getattr(ap, "version_number", 1) or 1,
                title=ap.title,
                start_date=ap.start_date,
                target_completion_date=ap.target_completion_date,
                daily_study_hours=ap_pref.daily_study_hours if ap_pref else 2.0,
                available_days=list(ap_pref.available_days) if (ap_pref and ap_pref.available_days) else [],
                total_scheduled_hours=ap.total_scheduled_hours,
                total_tasks=len(ap_tasks),
                completed_tasks=sum(1 for t in ap_tasks if t.status == TaskStatus.COMPLETED.value),
                archived_reason="Replaced by a newly generated study plan",
                created_at=ap.created_at,
                snapshot_tasks=[
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
                    for t in ap_tasks
                ],
                snapshot_milestones=[
                    {
                        "id": m.id,
                        "title": m.title,
                        "target_week": m.target_week,
                        "target_date": m.target_date.isoformat() if m.target_date else None,
                        "is_completed": m.is_completed,
                    }
                    for m in sorted(ap.milestones, key=lambda x: x.target_week)
                ],
            )
        )

    history_items.sort(key=lambda x: x.created_at, reverse=True)
    return history_items

@router.get("/{id}/export")
def export_plan_schedule_csv(
    id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Exports the complete study schedule as an Excel-compatible UTF-8 BOM CSV file."""
    plan = db.query(StudyPlan).filter(StudyPlan.id == id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Study plan not found.")

    if current_user.role != "ADMIN":
        if not current_user.student_profile or plan.student_id != current_user.student_profile.id:
            raise HTTPException(status_code=403, detail="Access denied to export this schedule.")
        if plan.enrollment and getattr(plan.enrollment, "access_type", AccessType.FULL.value) == AccessType.TRIAL.value:
            raise HTTPException(
                status_code=403,
                detail="Schedule download is locked for Free Trial accounts. Please enroll to unlock full access."
            )

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "Study Date",
        "Weekday",
        "Order",
        "Task Type",
        "Topic Code",
        "Task Title",
        "Description",
        "Estimated Hours",
        "Actual Logged Hours",
        "Status",
        "Completed Verified At",
        "Approval Status",
    ])

    for idx, t in enumerate(sorted(plan.tasks, key=lambda x: (x.scheduled_date, x.order_index)), start=1):
        writer.writerow([
            t.scheduled_date.isoformat() if t.scheduled_date else "",
            t.scheduled_date.strftime("%A") if t.scheduled_date else "",
            idx,
            t.task_type,
            t.topic.topic_code if t.topic else "",
            t.title,
            (t.description or "").replace("\n", " "),
            t.estimated_duration_hours,
            t.actual_duration_hours,
            t.status,
            t.completed_at.strftime("%Y-%m-%d %H:%M") if t.completed_at else "",
            plan.approval_status,
        ])

    csv_bytes = ("\ufeff" + buf.getvalue()).encode("utf-8")
    student_slug = plan.student.aptech_student_id if plan.student else "STUDENT"
    filename = f"{plan.course.course_code}_{student_slug}_Schedule.csv"

    return Response(
        content=csv_bytes,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

