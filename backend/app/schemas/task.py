from typing import Optional
from datetime import date, datetime
from pydantic import BaseModel, Field, ConfigDict

class TaskStatusUpdate(BaseModel):
    status: str # NOT_STARTED, IN_PROGRESS, COMPLETED, MISSED, RESCHEDULED
    actual_duration_hours: Optional[float] = None
    personal_notes: Optional[str] = None

class StudySessionCreate(BaseModel):
    duration_minutes: int = Field(gt=0, le=720)
    notes: Optional[str] = None

class StudySessionResponse(BaseModel):
    id: str
    task_id: str
    student_id: str
    duration_minutes: int
    notes: Optional[str]
    session_date: datetime

    model_config = ConfigDict(from_attributes=True)

class RescheduleRequest(BaseModel):
    reason: Optional[str] = None
