import logging
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token, generate_secure_token
from app.core.config import settings
from app.models.user import User, StudentProfile, UserRole
from app.models.course import Course
from app.models.enrollment import Enrollment, EnrollmentStatus, AccessType
from app.models.tokens import InvitationToken, PasswordResetToken
from app.models.logs import AuditLog
from app.schemas.auth import (
    LoginRequest,
    TrialSignupRequest,
    TokenResponse,
    ActivateAccountRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    UserResponse
)
from app.services.email_service import EmailService
from app.api.deps import get_current_user

logger = logging.getLogger("aptech_planner")

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, response: Response, request: Request, db: Session = Depends(get_db)):
    logger.info(f"[LOGIN] Attempt for email='{payload.email}' from {request.client.host if request.client else 'unknown'}")

    user = db.query(User).filter(User.email == payload.email.lower().strip()).first()
    if not user:
        logger.warning(f"[LOGIN] No user found for email='{payload.email.lower().strip()}'")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password."
        )

    if not user.password_hash:
        logger.warning(f"[LOGIN] User {user.email} has no password hash (not activated)")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account not activated yet. Please check your email for your invitation link to set your password."
        )

    pw_ok = verify_password(payload.password, user.password_hash)
    logger.info(f"[LOGIN] Password verify for {user.email}: {pw_ok} (pw_len={len(payload.password)})")
    if not pw_ok:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password."
        )

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated.")

    if user.is_suspended:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is suspended. Please contact administrator.")

    access_token = create_access_token(subject=user.id, role=user.role)

    # Set secure HttpOnly cookie
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="lax",
        secure=False # Set to True in production with HTTPS
    )

    apt_id = None
    if user.student_profile:
        apt_id = user.student_profile.aptech_student_id

    # Audit log
    audit = AuditLog(
        actor_id=user.id,
        action="USER_LOGIN",
        resource_type="USER",
        resource_id=user.id,
        details={"email": user.email, "role": user.role},
        ip_address=request.client.host if request.client else None
    )
    db.add(audit)
    db.commit()

    return TokenResponse(
        access_token=access_token,
        role=user.role,
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        aptech_student_id=apt_id
    )

@router.post("/trial-signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def trial_signup(payload: TrialSignupRequest, response: Response, request: Request, db: Session = Depends(get_db)):
    """Self-service free trial signup: creates a student account with TRIAL (20% preview) enrollment and logs them in."""
    email_clean = payload.email.lower().strip()
    if len(payload.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long."
        )

    existing_user = db.query(User).filter(User.email == email_clean).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists. Please sign in using the Sign In button."
        )

    course = db.query(Course).filter(Course.id == payload.course_id, Course.is_active == True).first()
    if not course:
        raise HTTPException(status_code=404, detail="Selected course not found or inactive.")

    user = User(
        email=email_clean,
        full_name=payload.full_name.strip() or "Trial Student",
        role=UserRole.STUDENT.value,
        password_hash=get_password_hash(payload.password),
        is_active=True,
        is_suspended=False
    )
    db.add(user)
    db.flush()

    trial_code = f"TRIAL-{uuid.uuid4().hex[:8].upper()}"
    student = StudentProfile(
        user_id=user.id,
        aptech_student_id=trial_code,
        phone=payload.phone.strip() if payload.phone else None
    )
    db.add(student)
    db.flush()

    enrollment = Enrollment(
        student_id=student.id,
        course_id=course.id,
        status=EnrollmentStatus.ACTIVE.value,
        access_type=AccessType.TRIAL.value,
        notes="Self-service 20% Free Trial signup"
    )
    db.add(enrollment)
    db.flush()

    audit = AuditLog(
        actor_id=user.id,
        action="TRIAL_SIGNUP",
        resource_type="ENROLLMENT",
        resource_id=enrollment.id,
        details={"email": user.email, "course_code": course.course_code, "access_type": AccessType.TRIAL.value},
        ip_address=request.client.host if request.client else None
    )
    db.add(audit)
    db.commit()

    access_token = create_access_token(subject=user.id, role=user.role)
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="lax",
        secure=False
    )

    return TokenResponse(
        access_token=access_token,
        role=user.role,
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        aptech_student_id=trial_code
    )

@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(key="access_token")
    return {"message": "Logged out successfully."}

@router.post("/activate")
def activate_account(payload: ActivateAccountRequest, db: Session = Depends(get_db)):
    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters long.")

    invitation = db.query(InvitationToken).filter(
        InvitationToken.token == payload.token,
        InvitationToken.is_used == False
    ).first()

    if not invitation:
        raise HTTPException(status_code=400, detail="Invalid, expired or already used invitation token.")

    expires_at = invitation.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    if expires_at < now:
        raise HTTPException(status_code=400, detail="Invitation link has expired. Please contact admin for a new link.")

    user = db.query(User).filter(User.id == invitation.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user.password_hash = get_password_hash(payload.password)
    user.is_active = True
    invitation.is_used = True

    audit = AuditLog(
        actor_id=user.id,
        action="ACCOUNT_ACTIVATED",
        resource_type="USER",
        resource_id=user.id,
        details={"email": user.email}
    )
    db.add(audit)
    db.commit()

    return {"success": True, "message": "Account successfully activated! You may now sign in with your email and password."}

@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower().strip()).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found with this email address. Please check your email or contact Aptech administration."
        )
    if user.is_suspended:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is currently suspended. Please contact your Aptech center administrator."
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your account is not activated yet. Please use your activation link first or contact admin."
        )

    # Invalidate any previous unused reset tokens for this user
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.is_used == False
    ).update({"is_used": True})

    token_str = generate_secure_token()
    reset_token = PasswordResetToken(
        user_id=user.id,
        token=token_str,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=2),
        is_used=False
    )
    db.add(reset_token)
    db.commit()

    sent = EmailService.send_password_reset_email(user.email, token_str, user.full_name)
    if not sent:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not send password reset email. Please try again later."
        )

    return {
        "success": True,
        "message": f"Password reset link has been sent to {user.email}. Please check your inbox."
    }

@router.get("/verify-reset-token")
def verify_reset_token(token: str, db: Session = Depends(get_db)):
    token_record = db.query(PasswordResetToken).filter(
        PasswordResetToken.token == token,
        PasswordResetToken.is_used == False
    ).first()

    if not token_record:
        raise HTTPException(status_code=400, detail="Invalid or already used password reset link.")

    expires_at = token_record.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="This password reset link has expired. Please request a new one.")

    user = db.query(User).filter(User.id == token_record.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Associated user account not found.")

    return {"valid": True, "email": user.email}

@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters long.")

    token_record = db.query(PasswordResetToken).filter(
        PasswordResetToken.token == payload.token,
        PasswordResetToken.is_used == False
    ).first()

    if not token_record:
        raise HTTPException(status_code=400, detail="Invalid, already used, or expired reset token.")

    expires_at = token_record.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Reset token has expired. Please request a new password reset link.")

    user = db.query(User).filter(User.id == token_record.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user.password_hash = get_password_hash(payload.new_password)
    token_record.is_used = True

    audit = AuditLog(
        actor_id=user.id,
        action="PASSWORD_RESET",
        resource_type="USER",
        resource_id=user.id,
        details={"email": user.email}
    )
    db.add(audit)
    db.commit()

    return {"success": True, "message": "Password updated successfully! You can now log in with your new password."}

@router.get("/me", response_model=UserResponse)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    apt_id = None
    phone = None
    if current_user.student_profile:
        apt_id = current_user.student_profile.aptech_student_id
        phone = current_user.student_profile.phone

    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
        is_active=current_user.is_active,
        is_suspended=current_user.is_suspended,
        aptech_student_id=apt_id,
        phone=phone
    )

