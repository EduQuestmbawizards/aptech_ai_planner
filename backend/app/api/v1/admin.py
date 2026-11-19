from datetime import datetime, date, timezone, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from app.core.database import get_db
from app.core.security import generate_secure_token, get_password_hash
from app.core.config import settings
from app.models.user import User, StudentProfile, UserRole
from app.models.course import Course
from app.models.enrollment import Enrollment, EnrollmentStatus, AccessType
from app.models.planner import StudyPlan, StudyTask, StudySession, TaskStatus, PlanApprovalStatus
from app.models.attendance import Attendance, AttendanceStatus
from app.models.tokens import InvitationToken
from app.models.logs import AuditLog, AIUsageLog
from app.schemas.admin import (
    StudentCreateRequest,
    StudentUpdateRequest,
    StudentStatusUpdateRequest,
    StudentDetailResponse,
    AdminDashboardMetrics,
    AdminCreateRequest
)
from app.schemas.planner import AdminPlanReviewRequest, AdminPlanEditReviewRequest, TaskResponse
from app.services.email_service import EmailService
from app.services.scheduler_engine import SchedulerEngine
from app.api.v1.planner import serialize_study_plan
from app.api.deps import require_admin

router = APIRouter(prefix="/admin", tags=["Admin Management"], dependencies=[Depends(require_admin)])

@router.get("/dashboard", response_model=AdminDashboardMetrics)
def get_admin_dashboard(db: Session = Depends(get_db)):
    total_students = db.query(StudentProfile).count()
    active_students = (
        db.query(StudentProfile)
        .join(User, StudentProfile.user_id == User.id)
        .filter(User.is_active == True, User.is_suspended == False)
        .count()
    )
    pending_approvals = db.query(Enrollment).filter(Enrollment.status == EnrollmentStatus.PENDING.value).count()
    pending_plan_approvals = db.query(StudyPlan).filter(
        StudyPlan.is_active == True,
        or_(
            StudyPlan.approval_status == PlanApprovalStatus.PENDING_APPROVAL.value,
            StudyPlan.has_pending_edit == True,
        )
    ).count()
    suspended_accounts = (
        db.query(User)
        .filter(User.role == UserRole.STUDENT.value, User.is_suspended == True)
        .count()
    )
    total_courses = db.query(Course).filter(Course.is_active == True).count()
    active_plans = db.query(StudyPlan).filter(StudyPlan.is_active == True, StudyPlan.status == "IN_PROGRESS").count()
    completed_plans = db.query(StudyPlan).filter(StudyPlan.status == "COMPLETED").count()

    # Average student progress rate
    total_tasks = db.query(StudyTask).count()
    completed_tasks = db.query(StudyTask).filter(StudyTask.status == TaskStatus.COMPLETED.value).count()
    avg_completion = round((completed_tasks / total_tasks * 100), 1) if total_tasks > 0 else 0.0

    return AdminDashboardMetrics(
        total_students=total_students,
        active_students=active_students,
        pending_approvals=pending_approvals,
        pending_plan_approvals=pending_plan_approvals,
        suspended_accounts=suspended_accounts,
        total_courses=total_courses,
        active_study_plans=active_plans,
        completed_plans=completed_plans,
        avg_completion_rate=avg_completion
    )

@router.get("/students")
def list_students(
    search: Optional[str] = None,
    course_id: Optional[str] = None,
    status_filter: Optional[str] = None, # ACTIVE, SUSPENDED, PENDING
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    query = (
        db.query(StudentProfile)
        .join(User, StudentProfile.user_id == User.id)
        .filter(User.role == UserRole.STUDENT.value)
    )

    if search:
        search_fmt = f"%{search.strip()}%"
        query = query.filter(
            or_(
                User.full_name.ilike(search_fmt),
                User.email.ilike(search_fmt),
                StudentProfile.aptech_student_id.ilike(search_fmt)
            )
        )

    if course_id:
        query = query.join(Enrollment, Enrollment.student_id == StudentProfile.id).filter(Enrollment.course_id == course_id)

    if status_filter == "ACTIVE":
        query = query.filter(User.is_active == True, User.is_suspended == False)
    elif status_filter == "SUSPENDED":
        query = query.filter(User.is_suspended == True)
    elif status_filter == "PENDING":
        query = query.filter(User.password_hash == None)

    total = query.count()
    profiles = query.order_by(StudentProfile.created_at.desc()).offset(skip).limit(limit).all()

    results = []
    for p in profiles:
        u = p.user
        active_plans = [plan for plan in p.study_plans if plan.is_active]
        has_trial = any(e.access_type == AccessType.TRIAL.value for e in p.enrollments)
        has_full = any(e.access_type == AccessType.FULL.value for e in p.enrollments)
        access_type = AccessType.TRIAL.value if (has_trial and not has_full) else AccessType.FULL.value

        invitation_token = None
        activation_url = None
        if not u.password_hash:
            latest_inv = (
                db.query(InvitationToken)
                .filter(InvitationToken.user_id == u.id, InvitationToken.is_used == False)
                .order_by(InvitationToken.created_at.desc())
                .first()
            )
            if latest_inv:
                invitation_token = latest_inv.token
                base_url = settings.FRONTEND_URL.rstrip('/')
                activation_url = f"{base_url}/activate?token={latest_inv.token}"

        results.append({
            "id": p.id,
            "user_id": u.id,
            "full_name": u.full_name,
            "email": u.email,
            "phone": p.phone,
            "aptech_student_id": p.aptech_student_id,
            "is_active": u.is_active,
            "is_suspended": u.is_suspended,
            "has_activated": u.password_hash is not None,
            "invitation_token": invitation_token,
            "activation_url": activation_url,
            "created_at": p.created_at,
            "enrollments_count": len(p.enrollments),
            "active_plans_count": len(active_plans),
            "active_plan_id": active_plans[0].id if active_plans else None,
            "access_type": access_type,
            "has_trial_enrollment": has_trial,
            "track_type": getattr(p, "track_type", "COURSE"),
        })

    return {"total": total, "items": results}

@router.post("/students", status_code=status.HTTP_201_CREATED)
def create_student(
    payload: StudentCreateRequest,
    background_tasks: BackgroundTasks,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    # Check email uniqueness
    existing_user = db.query(User).filter(User.email == payload.email.lower().strip()).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="A user with this email address already exists.")

    # Check aptech_student_id uniqueness
    existing_id = db.query(StudentProfile).filter(StudentProfile.aptech_student_id == payload.aptech_student_id.strip()).first()
    if existing_id:
        raise HTTPException(status_code=400, detail="Aptech Student ID is already assigned to an existing profile.")

    track_type = (payload.track_type or "COURSE").strip().upper()

    # Validate course (only required for COURSE and BOTH tracks)
    course = None
    if payload.course_id and payload.course_id.strip():
        course = db.query(Course).filter(Course.id == payload.course_id.strip()).first()
        if not course:
            raise HTTPException(status_code=404, detail="Selected course not found.")
    elif track_type in {"COURSE", "BOTH"}:
        raise HTTPException(status_code=400, detail="Course selection is required for Course and Both tracks.")

    # Create user with no password hash (pending invitation activation)
    user = User(
        email=payload.email.lower().strip(),
        full_name=payload.full_name.strip(),
        role=UserRole.STUDENT.value,
        password_hash=None,
        is_active=True,
        is_suspended=False
    )
    db.add(user)
    db.flush()

    student = StudentProfile(
        user_id=user.id,
        aptech_student_id=payload.aptech_student_id.strip(),
        phone=payload.phone,
        track_type=track_type
    )
    db.add(student)
    db.flush()

    # Create approved active enrollment if a course was assigned
    if course:
        normalized_access = (payload.access_type or AccessType.FULL.value).strip().upper()
        if normalized_access not in {AccessType.FULL.value, AccessType.TRIAL.value}:
            raise HTTPException(status_code=400, detail="access_type must be FULL or TRIAL.")

        enrollment = Enrollment(
            student_id=student.id,
            course_id=course.id,
            status=EnrollmentStatus.ACTIVE.value,
            access_type=normalized_access,
            payment_reference=payload.payment_reference,
            notes=payload.notes
        )
        db.add(enrollment)
        db.flush()

    # Generate single-use invitation token
    token_str = generate_secure_token()
    invitation = InvitationToken(
        user_id=user.id,
        token=token_str,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=settings.INVITATION_TOKEN_EXPIRE_HOURS),
        is_used=False
    )
    db.add(invitation)

    # Audit log
    audit = AuditLog(
        actor_id=admin_user.id,
        action="ADMIN_CREATE_STUDENT",
        resource_type="STUDENT",
        resource_id=student.id,
        details={"student_email": user.email, "course_code": course.course_code if course else "PROFILE_BUILDING_ONLY", "track_type": track_type}
    )
    db.add(audit)
    db.commit()

    # Build direct activation URL
    base_url = settings.FRONTEND_URL.rstrip('/')
    activation_url = f"{base_url}/activate?token={token_str}"

    # Queue invitation email in background (non-blocking, instant response for admin)
    background_tasks.add_task(EmailService.send_invitation_email, user.email, user.full_name, token_str)

    return {
        "success": True,
        "message": f"Student {user.full_name} created and invited successfully.",
        "student_id": student.id,
        "invitation_token": token_str,
        "activation_url": activation_url
    }

@router.patch("/students/{student_id}/upgrade-access")
def upgrade_student_trial_to_full(
    student_id: str,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Upgrade all TRIAL enrollments for a student to FULL access, unlocking 100% of their planner & downloads."""
    student = db.query(StudentProfile).filter(StudentProfile.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found.")

    trial_enrollments = [e for e in student.enrollments if e.access_type == AccessType.TRIAL.value]
    if not trial_enrollments:
        raise HTTPException(status_code=400, detail="Student has no TRIAL enrollments to upgrade.")

    for enr in trial_enrollments:
        enr.access_type = AccessType.FULL.value

    audit = AuditLog(
        actor_id=admin_user.id,
        action="UPGRADE_TRIAL_TO_FULL",
        resource_type="STUDENT",
        resource_id=student.id,
        details={"upgraded_enrollments": [e.id for e in trial_enrollments]}
    )
    db.add(audit)
    db.commit()

    return {
        "success": True,
        "message": f"Upgraded {len(trial_enrollments)} enrollment(s) to FULL access.",
        "upgraded_count": len(trial_enrollments),
    }

@router.get("/students/{id}")
def get_student_detail(id: str, db: Session = Depends(get_db)):
    student = db.query(StudentProfile).filter(StudentProfile.id == id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found.")

    u = student.user
    enrollments_data = []
    for enr in student.enrollments:
        enrollments_data.append({
            "id": enr.id,
            "course_id": enr.course_id,
            "course_name": enr.course.name if enr.course else "Unknown",
            "course_code": enr.course.course_code if enr.course else "",
            "status": enr.status,
            "enrolled_date": enr.enrolled_date,
            "payment_reference": enr.payment_reference
        })

    plans_data = []
    for p in student.study_plans:
        plans_data.append({
            "id": p.id,
            "title": p.title,
            "is_active": p.is_active,
            "status": p.status,
            "start_date": p.start_date,
            "target_completion_date": p.target_completion_date,
            "total_tasks": len(p.tasks),
            "completed_tasks": sum(1 for t in p.tasks if t.status == TaskStatus.COMPLETED.value)
        })

    return {
        "id": student.id,
        "user_id": u.id,
        "full_name": u.full_name,
        "email": u.email,
        "phone": student.phone,
        "aptech_student_id": student.aptech_student_id,
        "is_active": u.is_active,
        "is_suspended": u.is_suspended,
        "has_activated": u.password_hash is not None,
        "created_at": student.created_at,
        "enrollments": enrollments_data,
        "study_plans": plans_data
    }

@router.patch("/students/{id}")
def update_student(id: str, payload: StudentUpdateRequest, db: Session = Depends(get_db)):
    student = db.query(StudentProfile).filter(StudentProfile.id == id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found.")

    if payload.full_name:
        student.user.full_name = payload.full_name.strip()
    if payload.phone is not None:
        student.phone = payload.phone
    if payload.target_career is not None:
        student.target_career = payload.target_career
    if payload.current_level is not None:
        student.current_level = payload.current_level

    db.commit()
    return {"success": True, "message": "Student profile updated successfully."}

@router.post("/students/{id}/invite")
def resend_student_invitation(
    id: str,
    background_tasks: BackgroundTasks,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    student = db.query(StudentProfile).filter(StudentProfile.id == id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found.")

    u = student.user
    token_str = generate_secure_token()
    invitation = InvitationToken(
        user_id=u.id,
        token=token_str,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=settings.INVITATION_TOKEN_EXPIRE_HOURS),
        is_used=False
    )
    db.add(invitation)

    audit = AuditLog(
        actor_id=admin_user.id,
        action="RESEND_INVITATION",
        resource_type="STUDENT",
        resource_id=student.id,
        details={"email": u.email}
    )
    db.add(audit)
    db.commit()

    base_url = settings.FRONTEND_URL.rstrip('/')
    activation_url = f"{base_url}/activate?token={token_str}"
    background_tasks.add_task(EmailService.send_invitation_email, u.email, u.full_name, token_str)

    return {
        "success": True,
        "message": f"Invitation dispatched to {u.email}",
        "invitation_token": token_str,
        "activation_url": activation_url
    }

@router.patch("/students/{id}/status")
def update_student_status(
    id: str,
    payload: StudentStatusUpdateRequest,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    student = db.query(StudentProfile).filter(StudentProfile.id == id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found.")

    u = student.user
    if payload.is_active is not None:
        u.is_active = payload.is_active
    if payload.is_suspended is not None:
        u.is_suspended = payload.is_suspended

    audit = AuditLog(
        actor_id=admin_user.id,
        action="UPDATE_STUDENT_STATUS",
        resource_type="USER",
        resource_id=u.id,
        details={"is_active": u.is_active, "is_suspended": u.is_suspended, "reason": payload.reason}
    )
    db.add(audit)
    db.commit()

    return {
        "success": True,
        "message": "Student account status updated.",
        "is_active": u.is_active,
        "is_suspended": u.is_suspended
    }

@router.delete("/students/{student_id}")
def delete_student(
    student_id: str,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    profile = db.query(StudentProfile).filter(StudentProfile.id == student_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Student not found.")

    user = profile.user
    student_name = user.full_name if user else "Unknown"
    student_email = user.email if user else ""
    apt_id = profile.aptech_student_id
    user_id = user.id if user else None

    if user_id:
        db.query(AuditLog).filter(AuditLog.actor_id == user_id).update({"actor_id": None})
        db.query(AIUsageLog).filter(AIUsageLog.user_id == user_id).update({"user_id": None})
        db.query(StudyPlan).filter(StudyPlan.reviewed_by == user_id).update({"reviewed_by": None})
        db.delete(user)
    else:
        db.delete(profile)

    audit = AuditLog(
        actor_id=current_admin.id,
        action="ADMIN_DELETED_STUDENT",
        resource_type="STUDENT",
        resource_id=student_id,
        details={"deleted_email": student_email, "deleted_name": student_name, "aptech_student_id": apt_id},
    )
    db.add(audit)
    db.commit()

    return {
        "success": True,
        "message": f"Student '{student_name}' ({student_email}) permanently deleted."
    }

@router.post("/create-admin", status_code=status.HTTP_201_CREATED)
def create_admin_user(
    payload: AdminCreateRequest,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters long.")

    existing = db.query(User).filter(User.email == payload.email.lower().strip()).first()
    if existing:
        raise HTTPException(status_code=400, detail="A user with this email address already exists.")

    new_admin = User(
        email=payload.email.lower().strip(),
        full_name=payload.full_name.strip(),
        role=UserRole.ADMIN.value,
        password_hash=get_password_hash(payload.password),
        is_active=True,
        is_suspended=False
    )
    db.add(new_admin)

    audit = AuditLog(
        actor_id=current_admin.id,
        action="ADMIN_CREATED_NEW_ADMIN",
        resource_type="USER",
        resource_id=new_admin.id,
        details={"new_admin_email": new_admin.email, "created_by": current_admin.email}
    )
    db.add(audit)
    db.commit()

    return {
        "success": True,
        "message": f"Administrator '{new_admin.full_name}' ({new_admin.email}) created successfully.",
        "admin_id": new_admin.id,
        "email": new_admin.email
    }

@router.get("/study-plans")
def list_student_study_plans(
    approval_status: Optional[str] = None,
    course_id: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = (
        db.query(StudyPlan)
        .join(StudentProfile, StudyPlan.student_id == StudentProfile.id)
        .join(User, StudentProfile.user_id == User.id)
        .join(Course, StudyPlan.course_id == Course.id)
        .filter(StudyPlan.is_active == True)
    )

    if approval_status and approval_status != "ALL":
        if approval_status == PlanApprovalStatus.PENDING_APPROVAL.value:
            query = query.filter(
                or_(
                    StudyPlan.approval_status == approval_status,
                    StudyPlan.has_pending_edit == True,
                )
            )
        else:
            query = query.filter(StudyPlan.approval_status == approval_status)
    if course_id:
        query = query.filter(StudyPlan.course_id == course_id)
    if search:
        s = f"%{search.strip()}%"
        query = query.filter(
            or_(
                User.full_name.ilike(s),
                User.email.ilike(s),
                StudentProfile.aptech_student_id.ilike(s),
                Course.name.ilike(s),
                Course.course_code.ilike(s),
            )
        )

    plans = query.order_by(StudyPlan.created_at.desc()).all()
    items = []
    for p in plans:
        serialized = serialize_study_plan(p, include_tasks=False)
        duration_days = max(1, (p.target_completion_date - p.start_date).days)
        completed_list = [t for t in p.tasks if t.status == TaskStatus.COMPLETED.value]
        completed_list_sorted = sorted(
            completed_list,
            key=lambda t: t.completed_at.timestamp() if t.completed_at else 0,
            reverse=True,
        )
        last_done = completed_list_sorted[0] if completed_list_sorted else None
        completion_pct = round((serialized.completed_tasks / serialized.total_tasks * 100), 1) if serialized.total_tasks > 0 else 0.0

        items.append({
            **serialized.model_dump(),
            "student_name": p.student.user.full_name if p.student and p.student.user else "Student",
            "student_email": p.student.user.email if p.student and p.student.user else "",
            "aptech_student_id": p.student.aptech_student_id if p.student else "",
            "duration_days": duration_days,
            "completion_percent": completion_pct,
            "last_completed_task_title": last_done.title if last_done else None,
            "last_completed_at": last_done.completed_at.isoformat() if (last_done and last_done.completed_at) else None,
        })

    return {"items": items, "total": len(items)}

@router.get("/study-plans/{plan_id}")
def get_admin_study_plan_detail(
    plan_id: str,
    db: Session = Depends(get_db)
):
    plan = db.query(StudyPlan).filter(StudyPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Study plan not found.")

    serialized = serialize_study_plan(plan, include_tasks=True, apply_trial_mask=False)
    duration_days = max(1, (plan.target_completion_date - plan.start_date).days)
    return {
        **serialized.model_dump(),
        "student_name": plan.student.user.full_name if plan.student and plan.student.user else "Student",
        "student_email": plan.student.user.email if plan.student and plan.student.user else "",
        "aptech_student_id": plan.student.aptech_student_id if plan.student else "",
        "duration_days": duration_days,
    }

@router.patch("/study-plans/{plan_id}/review")
def review_student_study_plan(
    plan_id: str,
    payload: AdminPlanReviewRequest,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    if payload.approval_status not in (
        PlanApprovalStatus.APPROVED.value,
        PlanApprovalStatus.CHANGES_REQUESTED.value,
    ):
        raise HTTPException(
            status_code=400,
            detail="approval_status must be APPROVED or CHANGES_REQUESTED.",
        )

    plan = db.query(StudyPlan).filter(StudyPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Study plan not found.")

    # Optional schedule adjustment by admin before approval
    if payload.available_days or payload.daily_study_hours or payload.target_completion_date:
        current_days = (
            plan.preference.available_days
            if plan.preference and plan.preference.available_days
            else ["MON", "TUE", "WED", "THU", "FRI", "SAT"]
        )
        SchedulerEngine.redistribute_remaining_tasks(
            db=db,
            study_plan_id=plan.id,
            new_available_days=payload.available_days or current_days,
            new_daily_hours=payload.daily_study_hours,
            new_target_date=payload.target_completion_date,
        )
        db.refresh(plan)

    plan.approval_status = payload.approval_status
    plan.admin_review_note = payload.admin_review_note
    plan.reviewed_by = current_admin.id
    plan.reviewed_at = datetime.now(timezone.utc)

    audit = AuditLog(
        actor_id=current_admin.id,
        action="ADMIN_REVIEW_STUDY_PLAN",
        resource_type="STUDY_PLAN",
        resource_id=plan.id,
        details={
            "approval_status": payload.approval_status,
            "student_id": plan.student_id,
            "course_code": plan.course.course_code if plan.course else "",
            "note": payload.admin_review_note,
        },
    )
    db.add(audit)
    db.commit()
    db.refresh(plan)

    return {
        "success": True,
        "message": (
            "Study plan approved! Student classes can now follow this schedule."
            if payload.approval_status == PlanApprovalStatus.APPROVED.value
            else "Changes requested. Student has been notified to adjust their schedule."
        ),
        "plan": serialize_study_plan(plan, include_tasks=False),
    }


@router.patch("/study-plans/{plan_id}/review-edit")
def review_student_plan_edit(
    plan_id: str,
    payload: AdminPlanEditReviewRequest,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Approve or request changes on a student's pending edit request for an already-approved plan."""
    if payload.decision not in (
        PlanApprovalStatus.APPROVED.value,
        PlanApprovalStatus.CHANGES_REQUESTED.value,
    ):
        raise HTTPException(
            status_code=400,
            detail="decision must be APPROVED or CHANGES_REQUESTED.",
        )

    plan = db.query(StudyPlan).filter(StudyPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Study plan not found.")
    if not plan.has_pending_edit or not plan.pending_edit_data:
        raise HTTPException(status_code=400, detail="This study plan does not have a pending edit request.")

    pending = dict(plan.pending_edit_data)

    if payload.decision == PlanApprovalStatus.CHANGES_REQUESTED.value:
        # Keep the current approved plan untouched and notify student on their pending request
        plan.pending_edit_data = {
            **pending,
            "edit_status": PlanApprovalStatus.CHANGES_REQUESTED.value,
            "admin_feedback": payload.admin_review_note or "Please adjust your requested days or daily study hours.",
        }
        audit = AuditLog(
            actor_id=current_admin.id,
            action="ADMIN_REJECT_PLAN_EDIT",
            resource_type="STUDY_PLAN",
            resource_id=plan.id,
            details={
                "student_id": plan.student_id,
                "note": payload.admin_review_note,
            },
        )
        db.add(audit)
        db.commit()
        db.refresh(plan)
        return {
            "success": True,
            "message": "Edit feedback sent to student. Their existing approved plan remains active.",
            "plan": serialize_study_plan(plan, include_tasks=False),
        }

    # APPROVED: 1) Snapshot current approved plan BEFORE modifying any tasks
    current_ver = getattr(plan, "version_number", 1) or 1
    SchedulerEngine.create_plan_version_snapshot(
        db=db,
        plan=plan,
        archived_reason=f"Saved before approving edit request (Version {current_ver} -> Version {current_ver + 1})",
        approved_by=current_admin.id,
    )

    # 2) Apply redistribution ONLY to uncompleted tasks
    new_days = payload.available_days or pending.get("available_days") or (
        plan.preference.available_days if plan.preference and plan.preference.available_days else ["MON", "TUE", "WED", "THU", "FRI", "SAT"]
    )
    new_hours = payload.daily_study_hours or pending.get("daily_study_hours")
    target_str = pending.get("target_completion_date")
    new_target = payload.target_completion_date or (date.fromisoformat(target_str) if target_str else None)

    SchedulerEngine.redistribute_remaining_tasks(
        db=db,
        study_plan_id=plan.id,
        new_available_days=new_days,
        new_daily_hours=new_hours,
        new_target_date=new_target,
    )

    db.refresh(plan)
    plan.version_number = current_ver + 1
    plan.has_pending_edit = False
    plan.pending_edit_data = None
    plan.approval_status = PlanApprovalStatus.APPROVED.value
    plan.admin_review_note = payload.admin_review_note
    plan.reviewed_by = current_admin.id
    plan.reviewed_at = datetime.now(timezone.utc)

    audit = AuditLog(
        actor_id=current_admin.id,
        action="ADMIN_APPROVE_PLAN_EDIT",
        resource_type="STUDY_PLAN",
        resource_id=plan.id,
        details={
            "student_id": plan.student_id,
            "old_version": current_ver,
            "new_version": plan.version_number,
            "new_days": new_days,
            "new_daily_hours": new_hours,
            "note": payload.admin_review_note,
        },
    )
    db.add(audit)
    db.commit()
    db.refresh(plan)

    return {
        "success": True,
        "message": f"Edited plan approved (now Version {plan.version_number})! Previous version saved in Plan History.",
        "plan": serialize_study_plan(plan, include_tasks=False),
    }


@router.patch("/study-plans/{plan_id}/tasks/{task_id}/complete")
def admin_mark_task_complete(
    plan_id: str,
    task_id: str,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Allows Admin/Teacher to mark a student's study task as COMPLETED (2-way sync, permanently locked)."""
    plan = db.query(StudyPlan).filter(StudyPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Study plan not found.")

    task = (
        db.query(StudyTask)
        .filter(StudyTask.id == task_id, StudyTask.study_plan_id == plan.id)
        .first()
    )
    if not task:
        raise HTTPException(status_code=404, detail="Study task not found in this plan.")

    if task.status != TaskStatus.COMPLETED.value:
        task.status = TaskStatus.COMPLETED.value
        if not task.completed_at:
            task.completed_at = datetime.now(timezone.utc)

        existing_sessions = db.query(StudySession).filter(StudySession.task_id == task.id).all()
        if not existing_sessions:
            credit_hours = (
                task.actual_duration_hours
                if task.actual_duration_hours and task.actual_duration_hours > 0
                else (task.estimated_duration_hours or 1.0)
            )
            auto_minutes = max(1, int(round(credit_hours * 60)))
            db.add(
                StudySession(
                    task_id=task.id,
                    student_id=plan.student_id,
                    duration_minutes=auto_minutes,
                    notes="Verified & marked complete by Teacher/Admin",
                )
            )
            task.actual_duration_hours = round(auto_minutes / 60.0, 2)

        # Auto-link attendance as PRESENT for the task scheduled date or today
        att_date = task.scheduled_date or date.today()
        existing_att = db.query(Attendance).filter(
            Attendance.enrollment_id == plan.enrollment_id,
            Attendance.attendance_date == att_date
        ).first()
        if existing_att:
            existing_att.status = AttendanceStatus.PRESENT.value
            existing_att.study_task_id = task.id
            existing_att.marked_by = current_admin.id
            existing_att.remarks = f"Auto-marked PRESENT on completing '{task.title}'"
            existing_att.updated_at = datetime.now(timezone.utc)
        else:
            db.add(
                Attendance(
                    student_id=plan.student_id,
                    enrollment_id=plan.enrollment_id,
                    study_task_id=task.id,
                    attendance_date=att_date,
                    status=AttendanceStatus.PRESENT.value,
                    remarks=f"Auto-marked PRESENT on completing '{task.title}'",
                    marked_by=current_admin.id
                )
            )

        db.add(
            AuditLog(
                actor_id=current_admin.id,
                action="ADMIN_COMPLETE_STUDY_TASK",
                resource_type="STUDY_TASK",
                resource_id=task.id,
                details={
                    "study_plan_id": plan.id,
                    "student_id": plan.student_id,
                    "task_title": task.title,
                },
            )
        )
        db.commit()
        db.refresh(task)

    db.refresh(plan)
    completed_count = sum(1 for t in plan.tasks if t.status == TaskStatus.COMPLETED.value)

    return {
        "success": True,
        "message": f"Topic '{task.title}' marked as Completed & locked!",
        "completed_tasks": completed_count,
        "total_tasks": len(plan.tasks),
        "task": TaskResponse(
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
            personal_notes=task.personal_notes,
        ),
    }


