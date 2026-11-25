from typing import Optional, List
from datetime import datetime, date
from pydantic import BaseModel, Field, ConfigDict, field_validator


class ProfileRoadmapItemBase(BaseModel):
    period: str
    order_index: int = 1
    main_actions: str
    milestones_outputs: Optional[str] = None
    status: str = "PROPOSED"
    meeting_topic: Optional[str] = None
    session_date: Optional[str] = None
    session_duration_minutes: Optional[int] = None
    meeting_notes: Optional[str] = None
    proposal_html_url: Optional[str] = None
    proposal_html_name: Optional[str] = None
    proposal_type: Optional[str] = "GLOBAL_COMPETITION"
    feedback_notes: Optional[str] = None


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
    proposal_html_url: Optional[str] = None
    proposal_html_name: Optional[str] = None
    proposal_type: Optional[str] = None
    feedback_notes: Optional[str] = None


class ProfileRoadmapCompleteRequest(BaseModel):
    meeting_topic: Optional[str] = Field(None, description="Topic or agenda covered in the meeting")
    session_date: Optional[str] = Field(None, description="Date of the session e.g. YYYY-MM-DD")
    session_duration_minutes: Optional[int] = Field(None, ge=1, le=600, description="Meeting duration in minutes")
    meeting_notes: Optional[str] = Field(None, description="Minutes of Meeting (MoM) and discussion notes")


class ProfileRoadmapStatusUpdateRequest(BaseModel):
    status: str = Field(..., description="PENDING, IN_PROGRESS, or COMPLETED")


class SessionAttachmentItem(BaseModel):
    url: str
    name: str
    type: Optional[str] = None
    size_bytes: Optional[int] = None


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
    attachments: Optional[List[SessionAttachmentItem]] = None


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
    attachments: Optional[List[SessionAttachmentItem]] = None


class ProfileSessionAttendanceResponse(BaseModel):
    id: str
    student_id: str
    roadmap_item_id: Optional[str] = None
    period: Optional[str] = None
    session_date: Optional[Any] = None
    topic: Optional[str] = "Mentorship Session"
    description: Optional[str] = ""
    duration_minutes: Optional[int] = 45
    status: Optional[str] = "PRESENT"
    remarks: Optional[str] = None
    marked_by: Optional[str] = None
    marked_by_name: Optional[str] = None
    document_url: Optional[str] = None
    document_name: Optional[str] = None
    document_type: Optional[str] = None
    document_size_bytes: Optional[int] = None
    attachments: Optional[List[SessionAttachmentItem]] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True, extra="ignore")

    @field_validator("attachments", mode="before")
    @classmethod
    def parse_attachments(cls, v):
        if v is None:
            return []
        if isinstance(v, str):
            try:
                import json
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    return parsed
            except Exception:
                return []
        if isinstance(v, list):
            return v
        return []


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
    proposal_html_url: Optional[str] = None
    proposal_html_name: Optional[str] = None
    proposal_type: Optional[str] = None
    feedback_notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    sessions: Optional[List[ProfileSessionAttendanceResponse]] = []

    model_config = ConfigDict(from_attributes=True, extra="ignore")


class ProfileRoadmapStats(BaseModel):
    total_items: int = 0
    completed: int = 0
    in_progress: int = 0
    pending: int = 0
    completion_percentage: float = 0.0
    total_session_minutes: int = 0
    total_sessions_count: int = 0

    model_config = ConfigDict(extra="ignore")


class ProfileRoadmapStudentSummary(BaseModel):
    student_id: str
    student_name: Optional[str] = "Student"
    student_email: Optional[str] = ""
    aptech_student_id: Optional[str] = ""
    track_type: Optional[str] = "COURSE"
    stats: Optional[ProfileRoadmapStats] = None
    items: Optional[List[ProfileRoadmapItemResponse]] = []
    sessions: Optional[List[ProfileSessionAttendanceResponse]] = []

    model_config = ConfigDict(from_attributes=True, extra="ignore")

