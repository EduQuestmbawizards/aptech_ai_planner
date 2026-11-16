import uuid
from datetime import datetime, date, timezone
from enum import Enum
from sqlalchemy import Column, String, Date, Text, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base

class AttendanceStatus(str, Enum):
    PRESENT = "PRESENT"
    ABSENT = "ABSENT"
    LATE = "LATE"
    EXCUSED = "EXCUSED"

class Attendance(Base):
    __tablename__ = "attendances"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    student_id = Column(String(36), ForeignKey("student_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    enrollment_id = Column(String(36), ForeignKey("enrollments.id", ondelete="CASCADE"), nullable=False, index=True)
    study_task_id = Column(String(36), ForeignKey("study_tasks.id", ondelete="SET NULL"), nullable=True)
    attendance_date = Column(Date, default=date.today, nullable=False, index=True)
    status = Column(String(16), default=AttendanceStatus.PRESENT.value, nullable=False)
    remarks = Column(Text, nullable=True)
    marked_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("enrollment_id", "attendance_date", name="uq_enrollment_date_attendance"),
    )

    student = relationship("StudentProfile", backref="attendances")
    enrollment = relationship("Enrollment", backref="attendances")
    study_task = relationship("StudyTask", backref="attendances")
    marker = relationship("User", foreign_keys=[marked_by])

