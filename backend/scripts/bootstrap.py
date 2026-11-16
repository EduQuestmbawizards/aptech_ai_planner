import os
import sys
import json
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.append(str(backend_dir))

from app.core.database import SessionLocal, Base, engine
from app.core.security import get_password_hash
from app.models.user import User, StudentProfile, UserRole
from app.models.course import Course
from app.services.course_service import CourseService
from app.schemas.course import CourseCreateRequest

def bootstrap():
    print("=" * 60)
    print("APTECH AI PLANNER — SYSTEM BOOTSTRAP")
    print("=" * 60)

    # 1. Create tables
    print("-> Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("   Tables verified.")

    db = SessionLocal()
    try:
        # 2. Check / create admin account
        admin_email = os.getenv("ADMIN_EMAIL", "admin@aptech.edu")
        admin_pass = os.getenv("ADMIN_PASSWORD", "AptechAdmin@2026!")

        existing_admin = db.query(User).filter(User.email == admin_email).first()
        if not existing_admin:
            print(f"-> Creating initial Admin account ({admin_email})...")
            admin_user = User(
                email=admin_email,
                full_name="Aptech Master Administrator",
                role=UserRole.ADMIN.value,
                password_hash=get_password_hash(admin_pass),
                is_active=True,
                is_suspended=False
            )
            db.add(admin_user)
            db.commit()
            print(f"   Admin account created. Password: {admin_pass}")
        else:
            print(f"   Admin account already exists ({admin_email}).")

        # 3. Seed Course Catalogues from course_data/*.json (EduQuest/MBA Wizards + Aptech)
        for catalogue_name in ("sample_courses.json", "aptech_courses.json"):
            courses_file = backend_dir.parent / "course_data" / catalogue_name
            if courses_file.exists():
                print(f"-> Loading courses from {courses_file.name}...")
                with open(courses_file, "r", encoding="utf-8") as f:
                    content = f.read()
                result = CourseService.import_courses_from_json(db, content)
                print(f"   Imported: {result['imported_count']} new courses | Skipped: {result['skipped_count']} existing.")
            else:
                print(f"   Notice: {courses_file} not found.")

        # 4. Check / create a sample student for local development convenience
        student_email = "student.demo@aptech.edu"
        student_pass = "StudentDemo@2026!"
        existing_student = db.query(User).filter(User.email == student_email).first()
        if not existing_student:
            print(f"-> Creating pre-activated demo student ({student_email})...")
            st_user = User(
                email=student_email,
                full_name="Aarav Mehta",
                role=UserRole.STUDENT.value,
                password_hash=get_password_hash(student_pass),
                is_active=True,
                is_suspended=False
            )
            db.add(st_user)
            db.flush()

            st_profile = StudentProfile(
                user_id=st_user.id,
                aptech_student_id="APT-MUM-2026-1001",
                phone="+91 98200 12345",
                current_level="INTERMEDIATE",
                target_career="Full Stack Python Developer"
            )
            db.add(st_profile)
            db.flush()

            # Enroll in SAT-PREP if exists
            course = db.query(Course).filter(Course.course_code == "SAT-PREP").first()
            if course:
                from app.models.enrollment import Enrollment, EnrollmentStatus
                enrollment = Enrollment(
                    student_id=st_profile.id,
                    course_id=course.id,
                    status=EnrollmentStatus.ACTIVE.value,
                    notes="Bootstrap pre-approved enrollment"
                )
                db.add(enrollment)

            db.commit()
            print(f"   Demo student created. Login: {student_email} / {student_pass}")

        print("=" * 60)
        print("BOOTSTRAP COMPLETED SUCCESSFULLY!")
        print("=" * 60)
    finally:
        db.close()

if __name__ == "__main__":
    bootstrap()

