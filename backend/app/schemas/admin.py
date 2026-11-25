from typing import Optional, List
from datetime import datetime, date
from pydantic import BaseModel, EmailStr, ConfigDict

class StudentCreateRequest(BaseModel):
    full_name: str
    email: EmailStr
    phone: Optional[str] = None
    aptech_student_id: str
    course_id: Optional[str] = None # initial course to enroll (optional for PROFILE_BUILDING)
    access_type: str = "FULL" # FULL or TRIAL
    payment_reference: Optional[str] = None
    notes: Optional[str] = None
    track_type: Optional[str] = "COURSE" # COURSE, PROFILE_BUILDING, BOTH
    profile_timeline: Optional[str] = None # e.g. "November 2026 to December 2027"
    profile_start_date: Optional[str] = None
    profile_end_date: Optional[str] = None

class StudentUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    target_career: Optional[str] = None
    current_level: Optional[str] = None
    profile_timeline: Optional[str] = None
    profile_start_date: Optional[str] = None
    profile_end_date: Optional[str] = None

class StudentStatusUpdateRequest(BaseModel):
    is_active: Optional[bool] = None
    is_suspended: Optional[bool] = None
    reason: Optional[str] = None

class StudentDetailResponse(BaseModel):
    id: str
    user_id: str
    full_name: str
    email: str
    phone: Optional[str]
    aptech_student_id: str
    role: str
    is_active: bool
    is_suspended: bool
    has_password: bool
    created_at: datetime
    enrollments_count: int
    active_plans_count: int

    model_config = ConfigDict(from_attributes=True)

class AdminCreateRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str

class AdminUserResponse(BaseModel):
    id: str
    full_name: str
    email: str
    role: str
    is_active: bool
    is_suspended: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class AdminStatusUpdateRequest(BaseModel):
    is_active: Optional[bool] = None
    is_suspended: Optional[bool] = None

class AdminDashboardMetrics(BaseModel):
    total_students: int
    active_students: int
    pending_approvals: int
    pending_plan_approvals: int = 0
    suspended_accounts: int
    total_courses: int
    active_study_plans: int
    completed_plans: int
    avg_completion_rate: float
