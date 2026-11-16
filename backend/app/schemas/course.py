from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict

class ResourceSchema(BaseModel):
    id: Optional[str] = None
    title: str
    resource_type: str # DOCUMENTATION, PDF, VIDEO, EXERCISE
    url: str
    description: Optional[str] = None

class TopicSchema(BaseModel):
    id: Optional[str] = None
    topic_code: str
    title: str
    description: Optional[str] = None
    estimated_hours: float
    difficulty: str = "INTERMEDIATE"
    order_index: int
    subtopics: List[str] = []
    resources: List[ResourceSchema] = []

class ModuleSchema(BaseModel):
    id: Optional[str] = None
    module_code: str
    title: str
    description: Optional[str] = None
    order_index: int
    estimated_hours: float
    topics: List[TopicSchema] = []

class CourseCreateRequest(BaseModel):
    course_code: str
    name: str
    description: Optional[str] = None
    official_duration_value: int
    official_duration_unit: str = "MONTHS"
    total_learning_hours: float
    syllabus_version: str = "v1.0"
    category: Optional[str] = None
    difficulty_level: str = "INTERMEDIATE"
    prerequisites: List[str] = []
    modules: List[ModuleSchema] = []

class CourseResponse(BaseModel):
    id: str
    course_code: str
    name: str
    description: Optional[str]
    official_duration_value: int
    official_duration_unit: str
    total_learning_hours: float
    syllabus_version: str
    category: Optional[str]
    difficulty_level: str
    prerequisites: List[str]
    is_active: bool
    modules_count: Optional[int] = 0
    topics_count: Optional[int] = 0
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class CourseDetailResponse(CourseResponse):
    modules: List[ModuleSchema] = []
