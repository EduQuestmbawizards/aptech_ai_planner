import logging
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.user import User, StudentProfile, UserRole
from app.models.course import Course
from app.models.enrollment import Enrollment, EnrollmentStatus
from app.models.logs import AuditLog
from app.schemas.eduquest import EduQuestRegistrationPayload

logger = logging.getLogger(__name__)

class EduQuestIntegrationService:
    @staticmethod
    def process_registration_payload(db: Session, payload: EduQuestRegistrationPayload, client_ip: str = None) -> dict:
        # Check course existence
        course = db.query(Course).filter(Course.course_code == payload.course_code).first()
        if not course:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Course code '{payload.course_code}' does not match any approved Aptech course catalogue entry."
            )

        # Check existing user / student profile
        user = db.query(User).filter(User.email == payload.email).first()
        if not user:
            # Create user without password (pending activation)
            user = User(
                email=payload.email,
                full_name=payload.full_name,
                role=UserRole.STUDENT.value,
                password_hash=None, # Inactive until admin approval and invitation token set
                is_active=False
            )
            db.add(user)
            db.flush()

        student = db.query(StudentProfile).filter(StudentProfile.user_id == user.id).first()
        if not student:
            # Check aptech_student_id uniqueness
            existing_apt_id = db.query(StudentProfile).filter(StudentProfile.aptech_student_id == payload.aptech_student_id).first()
            if existing_apt_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Aptech Student ID '{payload.aptech_student_id}' is already registered to another student profile."
                )

            student = StudentProfile(
                user_id=user.id,
                aptech_student_id=payload.aptech_student_id,
                phone=payload.phone
            )
            db.add(student)
            db.flush()

        # Check duplicate enrollment for same course
        existing_enrollment = db.query(Enrollment).filter(
            Enrollment.student_id == student.id,
            Enrollment.course_id == course.id
        ).first()

        if existing_enrollment:
            # Idempotent response
            return {
                "student_id": student.id,
                "enrollment_id": existing_enrollment.id,
                "status": existing_enrollment.status,
                "is_duplicate": True
            }

        enrollment = Enrollment(
            student_id=student.id,
            course_id=course.id,
            status=EnrollmentStatus.PENDING.value,
            payment_reference=payload.payment_reference,
            notes=f"EduQuest Webhook: Reg ID {payload.eduquest_registration_id}. {payload.additional_notes or ''}"
        )
        db.add(enrollment)
        db.flush()

        # Audit log entry
        audit = AuditLog(
            actor_id=None,
            action="EDUQUEST_WEBHOOK_REGISTRATION",
            resource_type="ENROLLMENT",
            resource_id=enrollment.id,
            details={
                "eduquest_reg_id": payload.eduquest_registration_id,
                "student_email": payload.email,
                "course_code": payload.course_code,
                "payment_ref": payload.payment_reference
            },
            ip_address=client_ip
        )
        db.add(audit)
        db.commit()

        return {
            "student_id": student.id,
            "enrollment_id": enrollment.id,
            "status": enrollment.status,
            "is_duplicate": False
        }

