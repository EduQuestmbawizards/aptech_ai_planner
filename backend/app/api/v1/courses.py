from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Body
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.course import Course, CourseModule, CourseTopic
from app.models.user import User
from app.schemas.course import CourseResponse, CourseDetailResponse, CourseCreateRequest
from app.services.course_service import CourseService
from app.api.deps import require_admin, get_current_user

router = APIRouter(prefix="/courses", tags=["Courses"])

@router.get("", response_model=List[CourseResponse])
def list_courses(category: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Course).filter(Course.is_active == True)
    if category:
        query = query.filter(Course.category == category)
    courses = query.order_by(Course.name).all()

    results = []
    for c in courses:
        results.append(
            CourseResponse(
                id=c.id,
                course_code=c.course_code,
                name=c.name,
                description=c.description,
                official_duration_value=c.official_duration_value,
                official_duration_unit=c.official_duration_unit,
                total_learning_hours=c.total_learning_hours,
                syllabus_version=c.syllabus_version,
                category=c.category,
                difficulty_level=c.difficulty_level,
                prerequisites=c.prerequisites or [],
                is_active=c.is_active,
                modules_count=len(c.modules),
                topics_count=sum(len(m.topics) for m in c.modules),
                created_at=c.created_at
            )
        )
    return results

@router.get("/{id}", response_model=CourseResponse)
def get_course(id: str, db: Session = Depends(get_db)):
    c = db.query(Course).filter(Course.id == id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Course not found.")

    return CourseResponse(
        id=c.id,
        course_code=c.course_code,
        name=c.name,
        description=c.description,
        official_duration_value=c.official_duration_value,
        official_duration_unit=c.official_duration_unit,
        total_learning_hours=c.total_learning_hours,
        syllabus_version=c.syllabus_version,
        category=c.category,
        difficulty_level=c.difficulty_level,
        prerequisites=c.prerequisites or [],
        is_active=c.is_active,
        modules_count=len(c.modules),
        topics_count=sum(len(m.topics) for m in c.modules),
        created_at=c.created_at
    )

@router.get("/{id}/syllabus")
def get_course_syllabus(id: str, db: Session = Depends(get_db)):
    c = db.query(Course).filter(Course.id == id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Course not found.")

    modules_data = []
    for m in sorted(c.modules, key=lambda mod: mod.order_index):
        topics_data = []
        for t in sorted(m.topics, key=lambda top: top.order_index):
            res_data = [
                {
                    "id": r.id,
                    "title": r.title,
                    "resource_type": r.resource_type,
                    "url": r.url,
                    "description": r.description
                }
                for r in t.resources
            ]
            topics_data.append({
                "id": t.id,
                "topic_code": t.topic_code,
                "title": t.title,
                "description": t.description,
                "estimated_hours": t.estimated_hours,
                "difficulty": t.difficulty,
                "order_index": t.order_index,
                "subtopics": t.subtopics or [],
                "resources": res_data
            })

        modules_data.append({
            "id": m.id,
            "module_code": m.module_code,
            "title": m.title,
            "description": m.description,
            "order_index": m.order_index,
            "estimated_hours": m.estimated_hours,
            "topics": topics_data
        })

    return {
        "course_id": c.id,
        "course_code": c.course_code,
        "name": c.name,
        "category": c.category,
        "official_duration_value": c.official_duration_value,
        "official_duration_unit": c.official_duration_unit,
        "total_learning_hours": c.total_learning_hours,
        "syllabus_version": c.syllabus_version,
        "modules": modules_data
    }

@router.post("", response_model=CourseResponse, dependencies=[Depends(require_admin)])
def create_course(payload: CourseCreateRequest, db: Session = Depends(get_db)):
    is_valid, warnings = CourseService.validate_course_hours(payload)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "Course duration validation failed.", "errors": warnings}
        )

    course = CourseService.create_course(db, payload)
    return CourseResponse(
        id=course.id,
        course_code=course.course_code,
        name=course.name,
        description=course.description,
        official_duration_value=course.official_duration_value,
        official_duration_unit=course.official_duration_unit,
        total_learning_hours=course.total_learning_hours,
        syllabus_version=course.syllabus_version,
        category=course.category,
        difficulty_level=course.difficulty_level,
        prerequisites=course.prerequisites or [],
        is_active=course.is_active,
        modules_count=len(course.modules),
        topics_count=sum(len(m.topics) for m in course.modules),
        created_at=course.created_at
    )

@router.post("/import", dependencies=[Depends(require_admin)])
async def import_courses(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()
    text = content.decode("utf-8")
    result = CourseService.import_courses_from_json(db, text)
    return result

