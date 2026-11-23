from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict

class AttendanceRecordSchema(BaseModel):
    id: str
    student_id: str
    enrollment_id: str
    course_id: Optional[str] = None
    course_name: Optional[str] = None
    course_code: Optional[str] = None
    student_name: Optional[str] = None
    aptech_student_id: Optional[str] = None
    study_task_id: Optional[str] = None
    task_title: Optional[str] = None
    attendance_date: date
    status: str # PRESENT, ABSENT, LATE, EXCUSED
    remarks: Optional[str] = None
    marked_by_name: Optional[str] = None
    topic: Optional[str] = None
    description: Optional[str] = None
    duration_minutes: Optional[int] = None
    document_url: Optional[str] = None
    document_name: Optional[str] = None
    document_type: Optional[str] = None
    document_size_bytes: Optional[int] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class AttendanceMarkItem(BaseModel):
    student_id: str
    enrollment_id: str
    status: str # PRESENT, ABSENT, LATE, EXCUSED
    remarks: Optional[str] = None
    study_task_id: Optional[str] = None

class BatchAttendanceRequest(BaseModel):
    attendance_date: date
    course_id: Optional[str] = None
    records: List[AttendanceMarkItem]

class AttendanceSummary(BaseModel):
    total_classes: int = 0
    present_count: int = 0
    absent_count: int = 0
    late_count: int = 0
    excused_count: int = 0
    percentage: float = 0.0

class StudentAttendanceStatsResponse(BaseModel):
    summary: AttendanceSummary
    records: List[AttendanceRecordSchema] = []

