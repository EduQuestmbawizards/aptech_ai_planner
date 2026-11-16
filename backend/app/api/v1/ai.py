from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import get_db
from app.models.user import User, StudentProfile, UserRole
from app.models.enrollment import Enrollment, EnrollmentStatus
from app.models.logs import AIUsageLog
from app.schemas.ai import AITutorQuestionRequest, AITutorResponse, AIUsageMetricResponse
from app.services.ai_tutor_service import AITutorService
from app.api.deps import get_current_user

router = APIRouter(prefix="/ai", tags=["AI Assistant"])

@router.post("/tutor", response_model=AITutorResponse)
def ask_ai_tutor(
    payload: AITutorQuestionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    target_course_id = payload.course_id

    # Verify enrollment if user is a student
    if current_user.role == UserRole.STUDENT.value:
        student = db.query(StudentProfile).filter(StudentProfile.user_id == current_user.id).first()
        if not student:
            raise HTTPException(status_code=403, detail="Student profile not found.")

        # Find all active enrollments for this student
        active_enrollments = (
            db.query(Enrollment)
            .filter(
                Enrollment.student_id == student.id,
                Enrollment.status == EnrollmentStatus.ACTIVE.value
            )
            .all()
        )

        if not active_enrollments:
            raise HTTPException(
                status_code=403,
                detail="You need at least one active, approved course enrollment to access the AI Learning Assistant."
            )

        # Match requested course (by id or course_code)
        matched_enrollment = None
        if target_course_id:
            for enr in active_enrollments:
                if enr.course_id == target_course_id or (enr.course and enr.course.course_code == target_course_id):
                    matched_enrollment = enr
                    break

        # Fallback to student's primary active enrollment if not specifically matched
        if not matched_enrollment:
            matched_enrollment = active_enrollments[0]

        target_course_id = matched_enrollment.course_id
    else:
        # For Admin/Staff, if no course provided, pick first available course
        if not target_course_id:
            first_course = db.query(Course).filter(Course.is_active == True).first()
            target_course_id = first_course.id if first_course else None

    return AITutorService.answer_question(
        db=db,
        user_id=current_user.id,
        course_id=target_course_id,
        topic_id=payload.topic_id,
        question=payload.question,
        conversation_history=payload.conversation_history or []
    )

@router.get("/usage", response_model=AIUsageMetricResponse)
def get_ai_usage_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(AIUsageLog)
    # If not admin, restrict to own usage
    if current_user.role != UserRole.ADMIN.value:
        query = query.filter(AIUsageLog.user_id == current_user.id)

    logs = query.all()

    total_reqs = len(logs)
    total_tokens = sum(l.total_tokens for l in logs)
    prompt_tokens = sum(l.prompt_tokens for l in logs)
    comp_tokens = sum(l.completion_tokens for l in logs)
    cost = sum(l.estimated_cost_usd for l in logs)

    feature_counts: Dict[str, int] = {}
    for l in logs:
        feature_counts[l.feature] = feature_counts.get(l.feature, 0) + 1

    return AIUsageMetricResponse(
        total_requests=total_reqs,
        total_tokens=total_tokens,
        prompt_tokens=prompt_tokens,
        completion_tokens=comp_tokens,
        estimated_cost_usd=round(cost, 4),
        by_feature=feature_counts
    )

