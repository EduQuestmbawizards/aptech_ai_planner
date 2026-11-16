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
    attendance
)

# Path to frontend build
FRONTEND_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("aptech_planner")

def _ensure_study_plan_columns():
    try:
        inspector = inspect(engine)
        if "study_plans" not in inspector.get_table_names():
            return
        existing_cols = {col["name"] for col in inspector.get_columns("study_plans")}
        statements = []
        if "approval_status" not in existing_cols:
            statements.append("ALTER TABLE study_plans ADD COLUMN approval_status VARCHAR(32) NOT NULL DEFAULT 'APPROVED'")
        if "admin_review_note" not in existing_cols:
            statements.append("ALTER TABLE study_plans ADD COLUMN admin_review_note TEXT")
        if "reviewed_by" not in existing_cols:
            statements.append("ALTER TABLE study_plans ADD COLUMN reviewed_by VARCHAR(36)")
        if "reviewed_at" not in existing_cols:
            statements.append("ALTER TABLE study_plans ADD COLUMN reviewed_at TIMESTAMP")
        if "version_number" not in existing_cols:
            statements.append("ALTER TABLE study_plans ADD COLUMN version_number INTEGER NOT NULL DEFAULT 1")
        if "has_pending_edit" not in existing_cols:
            statements.append("ALTER TABLE study_plans ADD COLUMN has_pending_edit BOOLEAN NOT NULL DEFAULT 0")
        if "pending_edit_data" not in existing_cols:
            statements.append("ALTER TABLE study_plans ADD COLUMN pending_edit_data JSON")

        if statements:
            with engine.begin() as conn:
                for stmt in statements:
                    conn.execute(text(stmt))
            logger.info(f"Migrated study_plans columns: {len(statements)} added.")
    except Exception as e:
        logger.warning(f"Column migration notice: {str(e)}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing database schema...")
    try:
        Base.metadata.create_all(bind=engine)
        _ensure_study_plan_columns()
        logger.info("Database tables initialized successfully.")
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

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception at {request.url.path}: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred. Please contact the administrator."}
    )

# Health Check
@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION
    }

# Register API Routers under /api
api_prefix = settings.API_V1_STR
app.include_router(auth.router, prefix=api_prefix)
app.include_router(admin.router, prefix=api_prefix)
app.include_router(courses.router, prefix=api_prefix)
app.include_router(enrollments.router, prefix=api_prefix)
app.include_router(planner.router, prefix=api_prefix)
app.include_router(tasks.router, prefix=api_prefix)
app.include_router(progress.router, prefix=api_prefix)
app.include_router(ai.router, prefix=api_prefix)
app.include_router(integrations.router, prefix=api_prefix)
app.include_router(attendance.router, prefix=api_prefix)

# --- Serve Frontend Static Files ---
if FRONTEND_DIST.exists() and (FRONTEND_DIST / "index.html").exists():
    # Serve static assets (JS, CSS, images) under /assets
    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="frontend-assets")

    # SPA catch-all: any non-API route returns index.html
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # If a specific static file exists in dist, serve it
        file_path = FRONTEND_DIST / full_path
        if full_path and file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        # Otherwise serve index.html for SPA routing
        return FileResponse(str(FRONTEND_DIST / "index.html"))

    logger.info(f"Serving frontend from {FRONTEND_DIST}")
else:
    logger.warning(f"Frontend dist not found at {FRONTEND_DIST}. Run 'npm run build' in frontend/.")

