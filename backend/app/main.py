import logging
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text
from app.core.config import settings
from app.core.database import engine, Base
import app.models # registers models
from app.api.v1 import (
    auth,
    admin,
    courses,
    enrollments,
    planner,
    tasks,
    progress,
    ai,
    integrations,
    attendance,
    profile_roadmap,
    chat
)

# Path to frontend build
FRONTEND_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("aptech_planner")

def _ensure_all_schema_columns():
    try:
        inspector = inspect(engine)
        table_names = inspector.get_table_names()
        is_pg = engine.dialect.name == "postgresql"

        schema_migrations = {
            "study_plans": [
                ("approval_status", "VARCHAR(32) NOT NULL DEFAULT 'APPROVED'"),
                ("admin_review_note", "TEXT"),
                ("reviewed_by", "VARCHAR(36)"),
                ("reviewed_at", "TIMESTAMP"),
                ("version_number", "INTEGER NOT NULL DEFAULT 1"),
                ("has_pending_edit", "BOOLEAN NOT NULL DEFAULT FALSE"),
                ("pending_edit_data", "JSON" if is_pg else "TEXT"),
                ("generation_source", "VARCHAR(32) NOT NULL DEFAULT 'HYBRID_AI'"),
            ],
            "student_profiles": [
                ("track_type", "VARCHAR(32) NOT NULL DEFAULT 'COURSE'"),
                ("phone", "VARCHAR(32)"),
                ("current_level", "VARCHAR(32) DEFAULT 'BEGINNER'"),
                ("target_career", "VARCHAR(128)"),
                ("profile_timeline", "VARCHAR(128)"),
                ("profile_start_date", "VARCHAR(64)"),
                ("profile_end_date", "VARCHAR(64)"),
            ],
            "users": [
                ("is_suspended", "BOOLEAN NOT NULL DEFAULT FALSE"),
                ("is_active", "BOOLEAN NOT NULL DEFAULT TRUE"),
            ],
            "enrollments": [
                ("access_type", "VARCHAR(16) NOT NULL DEFAULT 'FULL'"),
                ("enrolled_date", "DATE DEFAULT CURRENT_DATE"),
                ("valid_until", "DATE"),
                ("payment_reference", "VARCHAR(128)"),
                ("notes", "TEXT"),
                ("status", "VARCHAR(32) NOT NULL DEFAULT 'PENDING'"),
            ],
            "attendances": [
                ("study_task_id", "VARCHAR(36)"),
                ("remarks", "TEXT"),
                ("marked_by", "VARCHAR(36)"),
                ("status", "VARCHAR(16) NOT NULL DEFAULT 'PRESENT'"),
            ],
            "courses": [
                ("prerequisites", "JSON" if is_pg else "TEXT"),
                ("difficulty_level", "VARCHAR(32) DEFAULT 'INTERMEDIATE'"),
                ("category", "VARCHAR(64)"),
                ("syllabus_version", "VARCHAR(32) DEFAULT 'v1.0'"),
            ],
            "profile_roadmap_items": [
                ("meeting_topic", "VARCHAR(255)"),
                ("session_date", "VARCHAR(64)"),
                ("session_duration_minutes", "INTEGER"),
                ("meeting_notes", "TEXT"),
                ("completed_at", "TIMESTAMP"),
                ("marked_by", "VARCHAR(36)"),
                ("proposal_html_url", "VARCHAR(512)"),
                ("proposal_html_name", "VARCHAR(255)"),
                ("proposal_type", "VARCHAR(64) DEFAULT 'GLOBAL_COMPETITION'"),
                ("feedback_notes", "TEXT"),
                ("ai_blueprint", "TEXT"),
                ("target_timeline", "VARCHAR(128)"),
                ("priority", "VARCHAR(32) DEFAULT 'NORMAL'"),
            ],
            "profile_session_attendances": [
                ("status", "VARCHAR(16) NOT NULL DEFAULT 'PRESENT'"),
                ("duration_minutes", "INTEGER NOT NULL DEFAULT 45"),
                ("remarks", "TEXT"),
                ("marked_by", "VARCHAR(36)"),
                ("document_url", "VARCHAR(512)"),
                ("document_name", "VARCHAR(255)"),
                ("document_type", "VARCHAR(64)"),
                ("document_size_bytes", "INTEGER"),
                ("attachments", "TEXT"),
            ],
        }

        for table, cols in schema_migrations.items():
            if table not in table_names:
                continue
            try:
                existing_cols = {col["name"] for col in inspector.get_columns(table)}
            except Exception as insp_err:
                logger.warning(f"Failed to inspect columns for table {table}: {insp_err}")
                continue

            for col_name, col_def in cols:
                if col_name not in existing_cols:
                    stmt = f"ALTER TABLE {table} ADD COLUMN {col_name} {col_def}"
                    try:
                        with engine.begin() as conn:
                            conn.execute(text(stmt))
                        logger.info(f"Added column '{col_name}' to {table}.")
                    except Exception as col_err:
                        logger.warning(f"Notice migrating {table}.{col_name}: {col_err}")
    except Exception as e:
        logger.warning(f"Schema column migration notice: {str(e)}")

# Ensure schema and column updates are applied on import
try:
    Base.metadata.create_all(bind=engine)
    _ensure_all_schema_columns()
except Exception as e:
    logger.warning(f"Schema auto-check notice: {str(e)}")


def _ensure_initial_data():
    try:
        from app.core.database import SessionLocal
        from app.core.security import get_password_hash
        from app.models.user import User, StudentProfile, UserRole
        from app.models.course import Course
        from app.services.course_service import CourseService
        import os

        db = SessionLocal()
        try:
            admin_email = (settings.ADMIN_EMAIL or "admin@aptech.edu").lower().strip()
            admin_pass = os.getenv("ADMIN_PASSWORD", "AptechAdmin@2026!")

            # 1. Ensure configured admin account exists (Rupali)
            existing_admin = db.query(User).filter(User.email == admin_email).first()
            if not existing_admin:
                logger.info(f"Auto-creating initial admin account ({admin_email})...")
                admin_user = User(
                    email=admin_email,
                    full_name="Administrator",
                    role=UserRole.ADMIN.value,
                    password_hash=get_password_hash(admin_pass),
                    is_active=True,
                    is_suspended=False
                )
                db.add(admin_user)
                db.commit()
                logger.info("Admin account created successfully.")
            elif not existing_admin.password_hash or not existing_admin.is_active:
                existing_admin.password_hash = get_password_hash(admin_pass)
                existing_admin.is_active = True
                existing_admin.is_suspended = False
                db.commit()

            # 2. Ensure Super Admin Ankit account exists with password
            ankit_email = "ankitk629990@gmail.com"
            ankit_pass = os.getenv("ANKIT_ADMIN_PASSWORD", "12345678")
            existing_ankit = db.query(User).filter(User.email == ankit_email).first()
            if not existing_ankit:
                logger.info(f"Auto-creating Super Admin account ({ankit_email})...")
                ankit_user = User(
                    email=ankit_email,
                    full_name="ANKIT KUMAR GUPTA",
                    role=UserRole.SUPER_ADMIN.value,
                    password_hash=get_password_hash(ankit_pass),
                    is_active=True,
                    is_suspended=False
                )
                db.add(ankit_user)
                db.commit()
                logger.info("Super Admin Ankit created successfully.")
            else:
                existing_ankit.role = UserRole.SUPER_ADMIN.value
                existing_ankit.full_name = "ANKIT KUMAR GUPTA"
                existing_ankit.password_hash = get_password_hash(ankit_pass)
                existing_ankit.is_active = True
                existing_ankit.is_suspended = False
                if existing_ankit.student_profile:
                    db.delete(existing_ankit.student_profile)
                db.commit()

            # 3. Ensure course catalogues are loaded (auto-import any new or missing courses)
            root_course_dir = Path(__file__).resolve().parent.parent.parent / "course_data"
            for catalogue_name in ("sample_courses.json", "aptech_courses.json"):
                courses_file = root_course_dir / catalogue_name
                if courses_file.exists():
                    with open(courses_file, "r", encoding="utf-8") as f:
                        CourseService.import_courses_from_json(db, f.read())
        finally:
            db.close()
    except Exception as e:
        logger.warning(f"Initial data setup notice: {str(e)}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing database schema...")
    try:
        Base.metadata.create_all(bind=engine)
        _ensure_all_schema_columns()
        _ensure_initial_data()
        logger.info("Database tables and seed data initialized successfully.")
    except Exception as e:
        logger.error(f"Database schema initialization notice: {str(e)}")
    yield
    logger.info("Shutting down Aptech AI Planner application...")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Aptech AI Career & Study Planner Backend API Server",
    lifespan=lifespan
)

# CORS Middleware: allow_origin_regex=r".*" ensures ANY origin is allowed with credentials
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=86400,
)

# Explicit OPTIONS handler to guarantee preflight responses
@app.options("/{full_path:path}")
async def options_handler(request: Request, full_path: str):
    origin = request.headers.get("origin", "*")
    return Response(
        status_code=200,
        headers={
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD",
            "Access-Control-Allow-Headers": request.headers.get("access-control-request-headers", "*"),
            "Access-Control-Max-Age": "86400",
        }
    )

# Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception at {request.url.path}: {str(exc)}", exc_info=True)
    origin = request.headers.get("origin")
    headers = {}
    if origin:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
        headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD"
        headers["Access-Control-Allow-Headers"] = request.headers.get("access-control-request-headers", "*")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": f"An internal server error occurred: {str(exc)}"},
        headers=headers
    )

# Health Check
@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION
    }

# Register API Routers under /api AND at root level for maximum frontend compatibility
api_prefix = settings.API_V1_STR
api_routers = [
    auth.router,
    admin.router,
    courses.router,
    enrollments.router,
    planner.router,
    tasks.router,
    progress.router,
    ai.router,
    integrations.router,
    attendance.router,
    profile_roadmap.router,
    chat.router
]

for r in api_routers:
    app.include_router(r, prefix=api_prefix)
    app.include_router(r)

# --- Serve Frontend Static Files ---
if FRONTEND_DIST.exists() and (FRONTEND_DIST / "index.html").exists():
    # Serve static assets (JS, CSS, images) under /assets
    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="frontend-assets")

    # SPA catch-all: any non-API route returns index.html
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api/") or full_path.startswith("auth/"):
            return JSONResponse(status_code=404, content={"detail": "Not found"})
        file_path = FRONTEND_DIST / full_path
        if full_path and file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(FRONTEND_DIST / "index.html"))

    logger.info(f"Serving frontend from {FRONTEND_DIST}")
else:
    logger.warning(f"Frontend dist not found at {FRONTEND_DIST}. Run 'npm run build' in frontend/.")

