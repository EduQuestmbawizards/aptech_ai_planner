from typing import Optional, List
from datetime import date, datetime
from pydantic import BaseModel, Field, ConfigDict

class PlannerOnboardingRequest(BaseModel):
    enrollment_id: str
    start_date: Optional[date] = None
    target_completion_date: date
    requested_duration_days: int
    daily_study_hours: float = Field(gt=0, le=16)
    available_days: List[str] # ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
    preferred_learning_style: Optional[str] = "BALANCED" # PROJECT_BASED, VIDEO_HEAVY, THEORY_FIRST, BALANCED
    learning_goals: List[str] = []
    known_topics: List[str] = []
    weak_topics: List[str] = []
    pace_preference: Optional[str] = "STEADY" # ACCELERATED, STEADY, IN_DEPTH

class PlannerAdjustRequest(BaseModel):
    available_days: List[str] # ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
    daily_study_hours: Optional[float] = Field(default=None, gt=0, le=16)
    target_completion_date: Optional[date] = None

class CapacityFeasibilityResponse(BaseModel):
    is_feasible: bool
    total_syllabus_hours: float
    total_available_hours: float
    capacity_ratio: float
    recommended_min_days: int
    warnings: List[str] = []
    suggestions: List[str] = []

class MilestoneSchema(BaseModel):
    id: Optional[str] = None
    title: str
    target_week: int
    target_date: date
    is_completed: bool = False


class PendingEditDataSchema(BaseModel):
    requested_at: Optional[str] = None
    available_days: List[str] = []
    daily_study_hours: float
    target_completion_date: Optional[str] = None
    estimated_finish_date: Optional[str] = None
    remaining_hours: float = 0.0
    remaining_tasks_count: int = 0
    completed_tasks_count: int = 0
    edit_status: str = "PENDING_APPROVAL"  # PENDING_APPROVAL, CHANGES_REQUESTED
    admin_feedback: Optional[str] = None
    feasibility: Optional[CapacityFeasibilityResponse] = None


class StudyPlanVersionResponse(BaseModel):
    id: str
    study_plan_id: Optional[str] = None
    source_type: str = "VERSION_SNAPSHOT"  # VERSION_SNAPSHOT or ARCHIVED_PLAN
    version_number: int
    title: str
    start_date: date
    target_completion_date: date
    daily_study_hours: float
    available_days: List[str] = []
    total_scheduled_hours: float
    total_tasks: int
    completed_tasks: int
    archived_reason: Optional[str] = None
    created_at: datetime
    snapshot_tasks: List[dict] = []
    snapshot_milestones: List[dict] = []

    model_config = ConfigDict(from_attributes=True)

class TaskResponse(BaseModel):
    id: str
    study_plan_id: str
    topic_id: Optional[str]
    topic_code: Optional[str] = None
    title: str
    description: Optional[str]
    scheduled_date: date
    estimated_duration_hours: float
    actual_duration_hours: float
    task_type: str
    status: str
    completed_at: Optional[datetime]
    order_index: int
    personal_notes: Optional[str]
    is_locked: bool = False

    model_config = ConfigDict(from_attributes=True)

class StudyPlanResponse(BaseModel):
    id: str
    enrollment_id: str
    student_id: str
    course_id: str
    course_name: str
    course_code: str
    title: str
    syllabus_version: str
    start_date: date
    target_completion_date: date
    total_scheduled_hours: float
    is_active: bool
    status: str
    access_type: str = "FULL"
    unlocked_tasks_count: Optional[int] = None
    approval_status: str = "PENDING_APPROVAL"
    admin_review_note: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    daily_study_hours: Optional[float] = None
    available_days: List[str] = []
    feasibility: Optional[CapacityFeasibilityResponse] = None
    generation_source: str
    total_tasks: int
    completed_tasks: int
    version_number: int = 1
    has_pending_edit: bool = False
    pending_edit_data: Optional[dict] = None
    versions_count: int = 0
    milestones: List[MilestoneSchema] = []
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class StudyPlanDetailResponse(StudyPlanResponse):
    tasks: List[TaskResponse] = []

class AdminPlanReviewRequest(BaseModel):
    approval_status: str # APPROVED, CHANGES_REQUESTED
    admin_review_note: Optional[str] = None
    available_days: Optional[List[str]] = None
    daily_study_hours: Optional[float] = Field(default=None, gt=0, le=16)
    target_completion_date: Optional[date] = None

class AdminPlanEditReviewRequest(BaseModel):
    decision: str  # APPROVED, CHANGES_REQUESTED
    admin_review_note: Optional[str] = None
    available_days: Optional[List[str]] = None
    daily_study_hours: Optional[float] = Field(default=None, gt=0, le=16)
    target_completion_date: Optional[date] = None
