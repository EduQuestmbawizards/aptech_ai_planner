from datetime import date, datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import StudentProfile
from app.models.planner import StudyPlan, StudyTask, StudySession, TaskStatus
from app.models.enrollment import AccessType
from app.schemas.planner import TaskResponse
from app.schemas.task import TaskStatusUpdate, StudySessionCreate, StudySessionResponse
from app.api.v1.planner import get_unlocked_task_ids
from app.api.deps import require_student

router = APIRouter(prefix="/tasks", tags=["Daily Tasks"])


def _serialize_task_for_student(t: StudyTask, unlocked_cache: dict) -> TaskResponse:
    plan = t.study_plan
    if plan.id not in unlocked_cache:
        unlocked_cache[plan.id] = get_unlocked_task_ids(plan)
    unlocked_ids = unlocked_cache[plan.id]
    is_locked = unlocked_ids is not None and t.id not in unlocked_ids
    return TaskResponse(
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


def _assert_task_unlocked(task: StudyTask):
    unlocked_ids = get_unlocked_task_ids(task.study_plan)
    if unlocked_ids is not None and task.id not in unlocked_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This class is locked in your 20% Free Trial preview. Please enroll to unlock full access."
        )

@router.get("", response_model=List[TaskResponse])
def get_tasks(
    plan_id: Optional[str] = None,
    status_filter: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    student: StudentProfile = Depends(require_student),
    db: Session = Depends(get_db)
):
    query = (
        db.query(StudyTask)
        .join(StudyPlan, StudyTask.study_plan_id == StudyPlan.id)
        .filter(StudyPlan.student_id == student.id)
    )

    if plan_id:
        query = query.filter(StudyTask.study_plan_id == plan_id)
    else:
        # Default to active plan
        query = query.filter(StudyPlan.is_active == True)

    if status_filter:
        query = query.filter(StudyTask.status == status_filter)

    if start_date:
        query = query.filter(StudyTask.scheduled_date >= start_date)
    if end_date:
        query = query.filter(StudyTask.scheduled_date <= end_date)

    tasks = query.order_by(StudyTask.scheduled_date.asc(), StudyTask.order_index.asc()).all()

    unlocked_cache: dict = {}
    return [_serialize_task_for_student(t, unlocked_cache) for t in tasks]

@router.get("/today", response_model=List[TaskResponse])
def get_today_tasks(
    student: StudentProfile = Depends(require_student),
    db: Session = Depends(get_db)
):
    today = date.today()
    tasks = (
        db.query(StudyTask)
        .join(StudyPlan, StudyTask.study_plan_id == StudyPlan.id)
        .filter(
            StudyPlan.student_id == student.id,
            StudyPlan.is_active == True,
            StudyTask.scheduled_date == today
        )
        .order_by(StudyTask.order_index.asc())
        .all()
    )

    return [_serialize_task_for_student(t, {}) for t in tasks]

AUTO_LOG_NOTE = "Auto-logged on task completion"

@router.patch("/{id}/status", response_model=TaskResponse)
def update_task_status(
    id: str,
    payload: TaskStatusUpdate,
    student: StudentProfile = Depends(require_student),
    db: Session = Depends(get_db)
):
    task = (
        db.query(StudyTask)
        .join(StudyPlan, StudyTask.study_plan_id == StudyPlan.id)
        .filter(StudyTask.id == id, StudyPlan.student_id == student.id)
        .first()
    )
    if not task:
        raise HTTPException(status_code=404, detail="Task not found or does not belong to you.")

    _assert_task_unlocked(task)

    if task.status == TaskStatus.COMPLETED.value and payload.status != TaskStatus.COMPLETED.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Completed topics are permanently locked and cannot be unchecked or changed."
        )

    task.status = payload.status
    if payload.actual_duration_hours is not None:
        task.actual_duration_hours = payload.actual_duration_hours
    if payload.personal_notes is not None:
        task.personal_notes = payload.personal_notes

    existing_sessions = db.query(StudySession).filter(StudySession.task_id == task.id).all()

    if payload.status == TaskStatus.COMPLETED.value:
        if not task.completed_at:
            task.completed_at = datetime.now(timezone.utc)
        # Auto-log estimated/specified study hours if the student didn't already log a timer/manual session
        if not existing_sessions:
            credit_hours = (
                payload.actual_duration_hours
                if payload.actual_duration_hours is not None and payload.actual_duration_hours > 0
                else (
                    task.actual_duration_hours
                    if task.actual_duration_hours and task.actual_duration_hours > 0
                    else task.estimated_duration_hours
                )
            )
            auto_minutes = max(1, int(round((credit_hours or 1.0) * 60)))
            auto_session = StudySession(
                task_id=task.id,
                student_id=student.id,
                duration_minutes=auto_minutes,
                notes=AUTO_LOG_NOTE,
            )
            db.add(auto_session)
            task.actual_duration_hours = round(auto_minutes / 60.0, 2)
    else:
        task.completed_at = None
        # Remove auto-logged session if task is reverted from COMPLETED
        remaining_minutes = 0
        for s in existing_sessions:
            if s.notes == AUTO_LOG_NOTE:
                db.delete(s)
            else:
                remaining_minutes += s.duration_minutes
        if payload.actual_duration_hours is None:
            task.actual_duration_hours = round(remaining_minutes / 60.0, 2)

    db.commit()
    db.refresh(task)

    return TaskResponse(
        id=task.id,
        study_plan_id=task.study_plan_id,
        topic_id=task.topic_id,
        topic_code=task.topic.topic_code if task.topic else None,
        title=task.title,
        description=task.description,
        scheduled_date=task.scheduled_date,
        estimated_duration_hours=task.estimated_duration_hours,
        actual_duration_hours=task.actual_duration_hours,
        task_type=task.task_type,
        status=task.status,
        completed_at=task.completed_at,
        order_index=task.order_index,
        personal_notes=task.personal_notes
    )

@router.post("/{id}/study-session", response_model=StudySessionResponse)
def log_study_session(
    id: str,
    payload: StudySessionCreate,
    student: StudentProfile = Depends(require_student),
    db: Session = Depends(get_db)
):
    task = (
        db.query(StudyTask)
        .join(StudyPlan, StudyTask.study_plan_id == StudyPlan.id)
        .filter(StudyTask.id == id, StudyPlan.student_id == student.id)
        .first()
    )
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")

    _assert_task_unlocked(task)

    session = StudySession(
        task_id=task.id,
        student_id=student.id,
        duration_minutes=payload.duration_minutes,
        notes=payload.notes
    )
    db.add(session)

    # Accumulate onto task actual_duration_hours
    task.actual_duration_hours = round(task.actual_duration_hours + (payload.duration_minutes / 60.0), 2)
    db.commit()
    db.refresh(session)

    return StudySessionResponse(
        id=session.id,
        task_id=session.task_id,
        student_id=session.student_id,
        duration_minutes=session.duration_minutes,
        notes=session.notes,
        session_date=session.session_date
    )

