import json
import logging
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.course import Course, CourseModule, CourseTopic, CourseResource
from app.schemas.course import CourseCreateRequest

logger = logging.getLogger(__name__)

class CourseService:
    @staticmethod
    def validate_course_hours(course_data: CourseCreateRequest) -> Tuple[bool, List[str]]:
        warnings = []
        is_valid = True
        
        modules_total = sum(m.estimated_hours for m in course_data.modules)
        if abs(modules_total - course_data.total_learning_hours) > 0.01:
            warnings.append(
                f"Course total hours ({course_data.total_learning_hours} hrs) does not match sum of module hours ({modules_total} hrs)."
            )
            is_valid = False

        for module in course_data.modules:
            topics_total = sum(t.estimated_hours for t in module.topics)
            if abs(topics_total - module.estimated_hours) > 0.01:
                warnings.append(
                    f"Module '{module.title}' hours ({module.estimated_hours} hrs) does not match sum of its topic hours ({topics_total} hrs)."
                )
                is_valid = False

        return is_valid, warnings

    @staticmethod
    def create_course(db: Session, course_in: CourseCreateRequest) -> Course:
        existing = db.query(Course).filter(Course.course_code == course_in.course_code).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Course code '{course_in.course_code}' already exists."
            )

        course = Course(
            course_code=course_in.course_code,
            name=course_in.name,
            description=course_in.description,
            official_duration_value=course_in.official_duration_value,
            official_duration_unit=course_in.official_duration_unit,
            total_learning_hours=course_in.total_learning_hours,
            syllabus_version=course_in.syllabus_version,
            category=course_in.category,
            difficulty_level=course_in.difficulty_level,
            prerequisites=course_in.prerequisites,
            is_active=True
        )
        db.add(course)
        db.flush()

        for mod_idx, mod_data in enumerate(course_in.modules, start=1):
            module = CourseModule(
                course_id=course.id,
                module_code=mod_data.module_code or f"MOD-{mod_idx}",
                title=mod_data.title,
                description=mod_data.description,
                order_index=mod_data.order_index or mod_idx,
                estimated_hours=mod_data.estimated_hours
            )
            db.add(module)
            db.flush()

            for top_idx, top_data in enumerate(mod_data.topics, start=1):
                topic = CourseTopic(
                    module_id=module.id,
                    topic_code=top_data.topic_code or f"TOPIC-{mod_idx}-{top_idx}",
                    title=top_data.title,
                    description=top_data.description,
                    estimated_hours=top_data.estimated_hours,
                    difficulty=top_data.difficulty,
                    order_index=top_data.order_index or top_idx,
                    subtopics=top_data.subtopics or []
                )
                db.add(topic)
                db.flush()

                for res_data in top_data.resources:
                    res = CourseResource(
                        topic_id=topic.id,
                        title=res_data.title,
                        resource_type=res_data.resource_type,
                        url=res_data.url,
                        description=res_data.description
                    )
                    db.add(res)

        db.commit()
        db.refresh(course)
        return course

    @staticmethod
    def import_courses_from_json(db: Session, json_content: str) -> Dict[str, Any]:
        try:
            courses_list = json.loads(json_content)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid JSON format: {str(e)}")

        imported = 0
        skipped = 0
        details = []

        for c_data in courses_list:
            code = c_data.get("course_code")
            existing = db.query(Course).filter(Course.course_code == code).first()
            if existing:
                skipped += 1
                details.append(f"Skipped existing course '{code}' ({c_data.get('name')})")
                continue

            try:
                course_req = CourseCreateRequest(**c_data)
                CourseService.create_course(db, course_req)
                imported += 1
                details.append(f"Successfully imported '{code}' ({c_data.get('name')})")
            except Exception as e:
                db.rollback()
                logger.error(f"Failed to import {code}: {str(e)}")
                details.append(f"Error importing '{code}': {str(e)}")

        return {
            "imported_count": imported,
            "skipped_count": skipped,
            "details": details
        }

