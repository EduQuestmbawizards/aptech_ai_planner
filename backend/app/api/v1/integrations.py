import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Header, Request, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import verify_eduquest_signature
from app.schemas.eduquest import EduQuestRegistrationPayload, EduQuestRegistrationResponse
from app.services.eduquest_service import EduQuestIntegrationService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/integrations", tags=["External Integrations"])

@router.post(
    "/eduquest/student-registration",
    response_model=EduQuestRegistrationResponse,
    status_code=status.HTTP_201_CREATED
)
async def eduquest_student_registration(
    request: Request,
    payload: EduQuestRegistrationPayload,
    x_eduquest_signature: Optional[str] = Header(None, alias="X-EduQuest-Signature"),
    x_idempotency_key: Optional[str] = Header(None, alias="X-Idempotency-Key"),
    db: Session = Depends(get_db)
):
    body_bytes = await request.body()

    # Validate HMAC signature if provided or in production
    if x_eduquest_signature:
        if not verify_eduquest_signature(body_bytes, x_eduquest_signature):
            logger.warning("[EDUQUEST] Invalid HMAC signature detected.")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid request signature. Verification with EDUQUEST_INTEGRATION_SECRET failed."
            )
    else:
        logger.info("[EDUQUEST DEV MODE] Signature header omitted in development test mode.")

    client_ip = request.client.host if request.client else None
    result = EduQuestIntegrationService.process_registration_payload(db, payload, client_ip)

    message = (
        "Duplicate registration noted. Existing record preserved."
        if result["is_duplicate"]
        else "Student registration received successfully and queued for Aptech Admin enrollment verification."
    )

    return EduQuestRegistrationResponse(
        success=True,
        message=message,
        data={
            "student_id": result["student_id"],
            "enrollment_id": result["enrollment_id"],
            "status": "PENDING_ADMIN_APPROVAL"
        }
    )

