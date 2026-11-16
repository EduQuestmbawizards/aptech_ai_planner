from typing import Optional
from datetime import date, datetime
from pydantic import BaseModel, ConfigDict

class EnrollmentCreateRequest(BaseModel):
    student_id: str
    course_id: str
    valid_until: Optional[date] = None
    payment_reference: Optional[str] = None
    notes: Optional[str] = None

class EnrollmentStatusUpdateRequest(BaseModel):
    status: str # PENDING, ACTIVE, SUSPENDED, EXPIRED, CANCELLED
    notes: Optional[str] = None

class EnrollmentResponse(BaseModel):
    id: str
    student_id: str
    student_name: str
    student_email: str
    aptech_student_id: str
    course_id: str
    course_name: str
    course_code: str
    status: str
    enrolled_date: date
    valid_until: Optional[date]
    payment_reference: Optional[str]
    notes: Optional[str]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
