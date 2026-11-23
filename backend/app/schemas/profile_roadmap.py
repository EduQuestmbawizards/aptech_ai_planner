from typing import Optional, List
from datetime import datetime, date
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


class ProfileSessionAttendanceCreate(BaseModel):
    roadmap_item_id: Optional[str] = None
    session_date: date
    topic: str = Field(..., description="Topic covered or taught in the session")
    description: str = Field(..., description="Detailed description of what was taught, discussion details, or MoM")
    duration_minutes: int = Field(45, ge=1, le=600, description="Session duration in minutes")
    status: str = Field("PRESENT", description="PRESENT, ABSENT, LATE, EXCUSED")
    remarks: Optional[str] = None
    document_url: Optional[str] = None
    document_name: Optional[str] = None
    document_type: Optional[str] = None
    document_size_bytes: Optional[int] = None


class ProfileSessionAttendanceUpdate(BaseModel):
    roadmap_item_id: Optional[str] = None
    session_date: Optional[date] = None
    topic: Optional[str] = None
    description: Optional[str] = None
    duration_minutes: Optional[int] = Field(None, ge=1, le=600)
    status: Optional[str] = None
    remarks: Optional[str] = None
    document_url: Optional[str] = None
    document_name: Optional[str] = None
    document_type: Optional[str] = None
    document_size_bytes: Optional[int] = None


class ProfileSessionAttendanceResponse(BaseModel):
    id: str
    student_id: str
    roadmap_item_id: Optional[str] = None
    period: Optional[str] = None
    session_date: date
    topic: str
    description: str
    duration_minutes: int
    status: str
    remarks: Optional[str] = None
    marked_by: Optional[str] = None
    marked_by_name: Optional[str] = None
    document_url: Optional[str] = None
    document_name: Optional[str] = None
    document_type: Optional[str] = None
    document_size_bytes: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


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
    sessions: List[ProfileSessionAttendanceResponse] = []

    model_config = ConfigDict(from_attributes=True)


class ProfileRoadmapStats(BaseModel):
    total_items: int
    completed: int
    in_progress: int
    pending: int
    completion_percentage: float
    total_session_minutes: int
    total_sessions_count: int = 0


class ProfileRoadmapStudentSummary(BaseModel):
    student_id: str
    student_name: str
    student_email: str
    aptech_student_id: str
    track_type: str
    stats: ProfileRoadmapStats
    items: List[ProfileRoadmapItemResponse]

