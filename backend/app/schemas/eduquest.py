from typing import Optional
from datetime import date
from pydantic import BaseModel, EmailStr

class EduQuestRegistrationPayload(BaseModel):
    eduquest_registration_id: str
    aptech_student_id: str
    full_name: str
    email: EmailStr
    phone: Optional[str] = None
    course_code: str
    payment_reference: Optional[str] = None
    payment_date: Optional[date] = None
    additional_notes: Optional[str] = None

class EduQuestRegistrationResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None

