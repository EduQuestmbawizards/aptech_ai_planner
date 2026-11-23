import uuid
from datetime import datetime, date, timezone
from enum import Enum
from sqlalchemy import Column, String, Integer, DateTime, Date, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base


class RoadmapItemStatus(str, Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"


class ProfileRoadmapItem(Base):
    __tablename__ = "profile_roadmap_items"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    student_id = Column(String(36), ForeignKey("student_profiles.id", ondelete="CASCADE"), index=True, nullable=False)
    period = Column(String(128), nullable=False)
    order_index = Column(Integer, default=0, nullable=False)
    main_actions = Column(Text, nullable=False)
    milestones_outputs = Column(Text, nullable=True)
    status = Column(String(32), default=RoadmapItemStatus.PENDING.value, nullable=False)

    # Meeting / Mentorship logging
    meeting_topic = Column(String(255), nullable=True)
    session_date = Column(String(64), nullable=True)
    session_duration_minutes = Column(Integer, nullable=True)
    meeting_notes = Column(Text, nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    marked_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    student = relationship("StudentProfile", back_populates="profile_roadmap_items")
    marked_by_user = relationship("User", foreign_keys=[marked_by])
    sessions = relationship("ProfileSessionAttendance", back_populates="roadmap_item", cascade="all, delete-orphan", order_by="ProfileSessionAttendance.session_date.asc()")


class ProfileSessionAttendance(Base):
    __tablename__ = "profile_session_attendances"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    student_id = Column(String(36), ForeignKey("student_profiles.id", ondelete="CASCADE"), index=True, nullable=False)
    roadmap_item_id = Column(String(36), ForeignKey("profile_roadmap_items.id", ondelete="SET NULL"), index=True, nullable=True)
    session_date = Column(Date, default=date.today, nullable=False, index=True)
    topic = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    duration_minutes = Column(Integer, default=45, nullable=False)
    status = Column(String(16), default="PRESENT", nullable=False) # PRESENT, ABSENT, LATE, EXCUSED
    remarks = Column(Text, nullable=True)
    marked_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Attached session reference document (PDF, Word, Excel, PPT, Image, etc.)
    document_url = Column(String(512), nullable=True)
    document_name = Column(String(255), nullable=True)
    document_type = Column(String(64), nullable=True)
    document_size_bytes = Column(Integer, nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    student = relationship("StudentProfile", backref="profile_attendances")
    roadmap_item = relationship("ProfileRoadmapItem", back_populates="sessions")
    marker = relationship("User", foreign_keys=[marked_by])


