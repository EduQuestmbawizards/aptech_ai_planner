import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, Text, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base

class Course(Base):
    __tablename__ = "courses"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    course_code = Column(String(64), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    official_duration_value = Column(Integer, nullable=False) # e.g. 6
    official_duration_unit = Column(String(32), default="MONTHS", nullable=False) # WEEKS, MONTHS, YEARS
    total_learning_hours = Column(Float, nullable=False) # e.g. 240.0
    syllabus_version = Column(String(32), default="v1.0", nullable=False)
    category = Column(String(64), nullable=True)
    difficulty_level = Column(String(32), default="INTERMEDIATE")
    prerequisites = Column(JSON, default=list) # List of string prereqs
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    modules = relationship("CourseModule", back_populates="course", order_by="CourseModule.order_index", cascade="all, delete-orphan")
    enrollments = relationship("Enrollment", back_populates="course")
    study_plans = relationship("StudyPlan", back_populates="course")

class CourseModule(Base):
    __tablename__ = "course_modules"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    course_id = Column(String(36), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    module_code = Column(String(64), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    order_index = Column(Integer, nullable=False)
    estimated_hours = Column(Float, nullable=False)

    course = relationship("Course", back_populates="modules")
    topics = relationship("CourseTopic", back_populates="module", order_by="CourseTopic.order_index", cascade="all, delete-orphan")

class CourseTopic(Base):
    __tablename__ = "course_topics"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    module_id = Column(String(36), ForeignKey("course_modules.id", ondelete="CASCADE"), nullable=False)
    topic_code = Column(String(64), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    estimated_hours = Column(Float, nullable=False)
    difficulty = Column(String(32), default="INTERMEDIATE")
    order_index = Column(Integer, nullable=False)
    subtopics = Column(JSON, default=list) # List of subtopics strings

    module = relationship("CourseModule", back_populates="topics")
    resources = relationship("CourseResource", back_populates="topic", cascade="all, delete-orphan")
    tasks = relationship("StudyTask", back_populates="topic")

class CourseResource(Base):
    __tablename__ = "course_resources"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    topic_id = Column(String(36), ForeignKey("course_topics.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    resource_type = Column(String(32), nullable=False) # DOCUMENTATION, PDF, VIDEO, EXERCISE
    url = Column(Text, nullable=False)
    description = Column(Text, nullable=True)

    topic = relationship("CourseTopic", back_populates="resources")

