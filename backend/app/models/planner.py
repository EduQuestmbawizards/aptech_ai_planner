import uuid
from datetime import datetime, date, timezone
from enum import Enum
from sqlalchemy import Column, String, Integer, Float, Text, Boolean, Date, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base

class TaskStatus(str, Enum):
    NOT_STARTED = "NOT_STARTED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    MISSED = "MISSED"
    RESCHEDULED = "RESCHEDULED"

class TaskType(str, Enum):
    TOPIC = "TOPIC"
    PRACTICE = "PRACTICE"
    REVISION = "REVISION"
    PROJECT = "PROJECT"
    ASSESSMENT = "ASSESSMENT"

class PlanApprovalStatus(str, Enum):
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    CHANGES_REQUESTED = "CHANGES_REQUESTED"

class StudyPlan(Base):
    __tablename__ = "study_plans"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    enrollment_id = Column(String(36), ForeignKey("enrollments.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(String(36), ForeignKey("student_profiles.id", ondelete="CASCADE"), nullable=False)
    course_id = Column(String(36), ForeignKey("courses.id", ondelete="RESTRICT"), nullable=False)
    title = Column(String(255), nullable=False)
    syllabus_version = Column(String(32), nullable=False)
    start_date = Column(Date, nullable=False)
    target_completion_date = Column(Date, nullable=False)
    total_scheduled_hours = Column(Float, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    status = Column(String(32), default="IN_PROGRESS", nullable=False) # IN_PROGRESS, COMPLETED, ARCHIVED
    approval_status = Column(String(32), default=PlanApprovalStatus.PENDING_APPROVAL.value, nullable=False)
    admin_review_note = Column(Text, nullable=True)
    reviewed_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    version_number = Column(Integer, default=1, nullable=False)
    has_pending_edit = Column(Boolean, default=False, nullable=False)
    pending_edit_data = Column(JSON, nullable=True)
    generation_source = Column(String(32), default="HYBRID_AI", nullable=False) # AI, DETERMINISTIC, HYBRID_AI
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    enrollment = relationship("Enrollment", back_populates="study_plans")
    student = relationship("StudentProfile", back_populates="study_plans")
    course = relationship("Course", back_populates="study_plans")
    preference = relationship("PlannerPreference", back_populates="study_plan", uselist=False, cascade="all, delete-orphan")
    milestones = relationship("StudyPlanMilestone", back_populates="study_plan", order_by="StudyPlanMilestone.target_week", cascade="all, delete-orphan")
    tasks = relationship("StudyTask", back_populates="study_plan", order_by="StudyTask.scheduled_date, StudyTask.order_index", cascade="all, delete-orphan")
    versions = relationship("StudyPlanVersion", back_populates="study_plan", order_by="StudyPlanVersion.version_number.desc()", cascade="all, delete-orphan")

class PlannerPreference(Base):
    __tablename__ = "planner_preferences"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    study_plan_id = Column(String(36), ForeignKey("study_plans.id", ondelete="CASCADE"), unique=True, nullable=False)
    target_completion_date = Column(Date, nullable=False)
    requested_duration_days = Column(Integer, nullable=False)
    daily_study_hours = Column(Float, nullable=False)
    available_days = Column(JSON, default=list) # e.g. ["MON", "TUE", "WED", "THU", "FRI", "SAT"]
    preferred_learning_style = Column(String(64), nullable=True) # "PROJECT_BASED", "VIDEO_HEAVY", "THEORY_FIRST", "BALANCED"
    learning_goals = Column(JSON, default=list)
    known_topics = Column(JSON, default=list)
    weak_topics = Column(JSON, default=list)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    study_plan = relationship("StudyPlan", back_populates="preference")

class StudyPlanMilestone(Base):
    __tablename__ = "study_plan_milestones"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    study_plan_id = Column(String(36), ForeignKey("study_plans.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    target_week = Column(Integer, nullable=False)
    target_date = Column(Date, nullable=False)
    is_completed = Column(Boolean, default=False, nullable=False)

    study_plan = relationship("StudyPlan", back_populates="milestones")

class StudyTask(Base):
    __tablename__ = "study_tasks"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    study_plan_id = Column(String(36), ForeignKey("study_plans.id", ondelete="CASCADE"), nullable=False)
    topic_id = Column(String(36), ForeignKey("course_topics.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    scheduled_date = Column(Date, nullable=False)
    estimated_duration_hours = Column(Float, nullable=False)
    actual_duration_hours = Column(Float, default=0.0, nullable=False)
    task_type = Column(String(32), default=TaskType.TOPIC.value, nullable=False)
    status = Column(String(32), default=TaskStatus.NOT_STARTED.value, nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    order_index = Column(Integer, default=1, nullable=False)
    personal_notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    study_plan = relationship("StudyPlan", back_populates="tasks")
    topic = relationship("CourseTopic", back_populates="tasks")
    sessions = relationship("StudySession", back_populates="task", cascade="all, delete-orphan")

class StudySession(Base):
    __tablename__ = "study_sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    task_id = Column(String(36), ForeignKey("study_tasks.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(String(36), ForeignKey("student_profiles.id", ondelete="CASCADE"), nullable=False)
    duration_minutes = Column(Integer, nullable=False)
    notes = Column(Text, nullable=True)
    session_date = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    task = relationship("StudyTask", back_populates="sessions")
    student = relationship("StudentProfile", back_populates="study_sessions")


class StudyPlanVersion(Base):
    """Immutable snapshot of a study plan before an edit or replacement."""
    __tablename__ = "study_plan_versions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    study_plan_id = Column(String(36), ForeignKey("study_plans.id", ondelete="CASCADE"), nullable=False)
    version_number = Column(Integer, nullable=False)
    title = Column(String(255), nullable=False)
    start_date = Column(Date, nullable=False)
    target_completion_date = Column(Date, nullable=False)
    daily_study_hours = Column(Float, nullable=False)
    available_days = Column(JSON, nullable=False)
    total_scheduled_hours = Column(Float, nullable=False)
    total_tasks = Column(Integer, default=0, nullable=False)
    completed_tasks = Column(Integer, default=0, nullable=False)
    archived_reason = Column(String(255), nullable=True)
    approved_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    snapshot_tasks = Column(JSON, nullable=False, default=list)
    snapshot_milestones = Column(JSON, nullable=False, default=list)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    study_plan = relationship("StudyPlan", back_populates="versions")


