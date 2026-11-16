import uuid
from datetime import datetime, date, timezone
from enum import Enum
from sqlalchemy import Column, String, Date, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class EnrollmentStatus(str, Enum):
    PENDING = "PENDING"
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"

class AccessType(str, Enum):
    FULL = "FULL"
    TRIAL = "TRIAL"

class Enrollment(Base):
    __tablename__ = "enrollments"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    student_id = Column(String(36), ForeignKey("student_profiles.id", ondelete="CASCADE"), nullable=False)
    course_id = Column(String(36), ForeignKey("courses.id", ondelete="RESTRICT"), nullable=False)
    status = Column(String(32), default=EnrollmentStatus.PENDING.value, nullable=False)
    access_type = Column(String(16), default=AccessType.FULL.value, nullable=False)
    enrolled_date = Column(Date, default=date.today, nullable=False)
    valid_until = Column(Date, nullable=True)
    payment_reference = Column(String(128), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    student = relationship("StudentProfile", back_populates="enrollments")
    course = relationship("Course", back_populates="enrollments")
    study_plans = relationship("StudyPlan", back_populates="enrollment", cascade="all, delete-orphan")

