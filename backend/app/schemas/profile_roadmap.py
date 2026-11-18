from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class ProfileRoadmapItemBase(BaseModel):
    period: str
    order_index: int = 1
    main_actions: str
    milestones_outputs: Optional[str] = None
    status: str = "PENDING"
    meeting_topic: Optional[str] = None
    session_date: Optional[str] = None
    session_duration_minutes: Optional[int] = None
    meeting_notes: Optional[str] = None


class ProfileRoadmapItemCreate(ProfileRoadmapItemBase):
    pass


class ProfileRoadmapItemUpdate(BaseModel):
    period: Optional[str] = None
    order_index: Optional[int] = None
    main_actions: Optional[str] = None
    milestones_outputs: Optional[str] = None
    status: Optional[str] = None
    meeting_topic: Optional[str] = None
    session_date: Optional[str] = None
    session_duration_minutes: Optional[int] = None
    meeting_notes: Optional[str] = None


class ProfileRoadmapCompleteRequest(BaseModel):
    meeting_topic: Optional[str] = Field(None, description="Topic or agenda covered in the meeting")
    session_date: Optional[str] = Field(None, description="Date of the session e.g. YYYY-MM-DD")
    session_duration_minutes: Optional[int] = Field(None, ge=1, le=600, description="Meeting duration in minutes")
    meeting_notes: Optional[str] = Field(None, description="Minutes of Meeting (MoM) and discussion notes")


class ProfileRoadmapStatusUpdateRequest(BaseModel):
    status: str = Field(..., description="PENDING, IN_PROGRESS, or COMPLETED")


class ProfileRoadmapItemResponse(BaseModel):
    id: str
    student_id: str
    period: str
    order_index: int
    main_actions: str
    milestones_outputs: Optional[str] = None
    status: str
    meeting_topic: Optional[str] = None
    session_date: Optional[str] = None
    session_duration_minutes: Optional[int] = None
    meeting_notes: Optional[str] = None
    completed_at: Optional[datetime] = None
    marked_by: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ProfileRoadmapStats(BaseModel):
    total_items: int
    completed: int
    in_progress: int
    pending: int
    completion_percentage: float
    total_session_minutes: int


class ProfileRoadmapStudentSummary(BaseModel):
    student_id: str
    student_name: str
    student_email: str
    aptech_student_id: str
    track_type: str
    stats: ProfileRoadmapStats
    items: List[ProfileRoadmapItemResponse]

