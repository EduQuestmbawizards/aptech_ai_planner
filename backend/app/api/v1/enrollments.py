from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User, StudentProfile, UserRole
from app.models.course import Course
from app.models.enrollment import Enrollment, EnrollmentStatus
from app.models.logs import AuditLog
from app.schemas.enrollment import EnrollmentCreateRequest, EnrollmentStatusUpdateRequest, EnrollmentResponse
from app.services.invoice_service import InvoiceService
from app.api.deps import require_admin, require_student, get_current_user

router = APIRouter(prefix="/enrollments", tags=["Enrollments"])

@router.get("", response_model=List[EnrollmentResponse], dependencies=[Depends(require_admin)])
def list_all_enrollments(
    status_filter: Optional[str] = None,
    course_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Enrollment).join(StudentProfile, Enrollment.student_id == StudentProfile.id).join(User, StudentProfile.user_id == User.id).join(Course, Enrollment.course_id == Course.id)

    if status_filter:
        query = query.filter(Enrollment.status == status_filter)
    if course_id:
        query = query.filter(Enrollment.course_id == course_id)

    enrollments = query.order_by(Enrollment.created_at.desc()).all()
    results = []
    for e in enrollments:
        results.append(
            EnrollmentResponse(
                id=e.id,
                student_id=e.student_id,
                student_name=e.student.user.full_name,
                student_email=e.student.user.email,
                aptech_student_id=e.student.aptech_student_id,
                course_id=e.course_id,
                course_name=e.course.name,
                course_code=e.course.course_code,
                status=e.status,
                enrolled_date=e.enrolled_date,
                valid_until=e.valid_until,
                payment_reference=e.payment_reference,
                notes=e.notes,
                created_at=e.created_at
            )
        )
    return results

@router.post("", response_model=EnrollmentResponse, dependencies=[Depends(require_admin)])
def create_enrollment(
    payload: EnrollmentCreateRequest,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    student = db.query(StudentProfile).filter(StudentProfile.id == payload.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    course = db.query(Course).filter(Course.id == payload.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found.")

    existing = db.query(Enrollment).filter(
        Enrollment.student_id == payload.student_id,
        Enrollment.course_id == payload.course_id
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Student is already enrolled in this course.")

    enrollment = Enrollment(
        student_id=payload.student_id,
        course_id=payload.course_id,
        status=EnrollmentStatus.ACTIVE.value,
        valid_until=payload.valid_until,
        payment_reference=payload.payment_reference,
        notes=payload.notes
    )
    db.add(enrollment)
    db.flush()

    audit = AuditLog(
        actor_id=admin_user.id,
        action="CREATE_ENROLLMENT",
        resource_type="ENROLLMENT",
        resource_id=enrollment.id,
        details={"student_id": student.id, "course_code": course.course_code}
    )
    db.add(audit)
    db.commit()

    return EnrollmentResponse(
        id=enrollment.id,
        student_id=student.id,
        student_name=student.user.full_name,
        student_email=student.user.email,
        aptech_student_id=student.aptech_student_id,
        course_id=course.id,
        course_name=course.name,
        course_code=course.course_code,
        status=enrollment.status,
        enrolled_date=enrollment.enrolled_date,
        valid_until=enrollment.valid_until,
        payment_reference=enrollment.payment_reference,
        notes=enrollment.notes,
        created_at=enrollment.created_at
    )

@router.patch("/{id}/status", dependencies=[Depends(require_admin)])
def update_enrollment_status(
    id: str,
    payload: EnrollmentStatusUpdateRequest,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    enrollment = db.query(Enrollment).filter(Enrollment.id == id).first()
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment record not found.")

    enrollment.status = payload.status
    if payload.notes:
        enrollment.notes = f"{enrollment.notes or ''} | {payload.notes}"

    audit = AuditLog(
        actor_id=admin_user.id,
        action="UPDATE_ENROLLMENT_STATUS",
        resource_type="ENROLLMENT",
        resource_id=enrollment.id,
        details={"new_status": payload.status}
    )
    db.add(audit)
    db.commit()

    return {"success": True, "message": f"Enrollment status set to {payload.status}."}

def _build_enrollment_detail_payload(e: Enrollment) -> dict:
    course = e.course
    student = e.student
    modules_summary = [
        {
            "module_code": m.module_code,
            "title": m.title,
            "estimated_hours": m.estimated_hours,
            "topics_count": len(m.topics),
        }
        for m in sorted(course.modules, key=lambda x: x.order_index)
    ]
    has_plan = any(p.is_active for p in e.study_plans)
    active_plan_id = next((p.id for p in e.study_plans if p.is_active), None)
    invoice_number = InvoiceService.build_invoice_number(e.id, e.enrolled_date)

    return {
        "enrollment_id": e.id,
        "invoice_number": invoice_number,
        "course_id": course.id,
        "course_name": course.name,
        "course_code": course.course_code,
        "description": course.description,
        "category": course.category,
        "difficulty_level": course.difficulty_level,
        "syllabus_version": course.syllabus_version,
        "prerequisites": course.prerequisites or [],
        "official_duration_value": course.official_duration_value,
        "official_duration_unit": course.official_duration_unit,
        "total_learning_hours": course.total_learning_hours,
        "modules_count": len(modules_summary),
        "topics_count": sum(m["topics_count"] for m in modules_summary),
        "modules_summary": modules_summary,
        "status": e.status,
        "access_type": getattr(e, "access_type", "FULL"),
        "has_active_plan": has_plan,
        "active_plan_id": active_plan_id,
        "enrolled_date": e.enrolled_date.isoformat() if e.enrolled_date else None,
        "valid_until": e.valid_until.isoformat() if e.valid_until else None,
        "payment_reference": e.payment_reference,
        "notes": e.notes,
        "student_name": student.user.full_name if student and student.user else "Student",
        "student_email": student.user.email if student and student.user else "",
        "aptech_student_id": student.aptech_student_id if student else "",
        "phone": student.phone if student else None,
    }


@router.get("/my")
def get_my_enrolled_courses(
    student: StudentProfile = Depends(require_student),
    db: Session = Depends(get_db)
):
    enrollments = (
        db.query(Enrollment)
        .filter(Enrollment.student_id == student.id)
        .order_by(Enrollment.created_at.desc())
        .all()
    )

    items = [_build_enrollment_detail_payload(e) for e in enrollments]
    return {"items": items}


@router.get("/{enrollment_id}/invoice")
def get_enrollment_invoice_data(
    enrollment_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    enrollment = db.query(Enrollment).filter(Enrollment.id == enrollment_id).first()
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found.")

    if current_user.role not in (UserRole.ADMIN.value, UserRole.SUPER_ADMIN.value, "ADMIN", "SUPER_ADMIN"):
        if not current_user.student_profile or enrollment.student_id != current_user.student_profile.id:
            raise HTTPException(status_code=403, detail="Access denied to this enrollment invoice.")
        if getattr(enrollment, "access_type", "FULL") == "TRIAL":
            raise HTTPException(
                status_code=403,
                detail="Invoice PDF download is locked for Free Trial accounts. Please enroll to unlock full access."
            )

    return _build_enrollment_detail_payload(enrollment)


@router.get("/{enrollment_id}/invoice/pdf")
def download_enrollment_invoice_pdf(
    enrollment_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    enrollment = db.query(Enrollment).filter(Enrollment.id == enrollment_id).first()
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found.")

    if current_user.role not in (UserRole.ADMIN.value, UserRole.SUPER_ADMIN.value, "ADMIN", "SUPER_ADMIN"):
        if not current_user.student_profile or enrollment.student_id != current_user.student_profile.id:
            raise HTTPException(status_code=403, detail="Access denied to this enrollment invoice.")
        if getattr(enrollment, "access_type", "FULL") == "TRIAL":
            raise HTTPException(
                status_code=403,
                detail="Invoice PDF download is locked for Free Trial accounts. Please enroll to unlock full access."
            )

    invoice_data = _build_enrollment_detail_payload(enrollment)
    pdf_bytes = InvoiceService.generate_invoice_pdf(invoice_data)
    filename = f"Aptech_Invoice_{invoice_data['course_code']}_{invoice_data['invoice_number']}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

