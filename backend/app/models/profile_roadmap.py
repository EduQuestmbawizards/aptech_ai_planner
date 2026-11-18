import uuid
from datetime import datetime, timezone
from enum import Enum
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text
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

