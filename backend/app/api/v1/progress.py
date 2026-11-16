from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import StudentProfile
from app.models.planner import StudyPlan
from app.schemas.progress import ProgressOverview, ModuleProgress, DailyStudyMetric
from app.services.analytics_service import AnalyticsService
from app.api.deps import require_student

router = APIRouter(prefix="/progress", tags=["Progress & Analytics"])

@router.get("/overview", response_model=ProgressOverview)
def get_progress_overview(
    plan_id: Optional[str] = None,
    student: StudentProfile = Depends(require_student),
    db: Session = Depends(get_db)
):
    target_plan_id = plan_id
    if not target_plan_id:
        active_plan = (
            db.query(StudyPlan)
            .filter(StudyPlan.student_id == student.id, StudyPlan.is_active == True)
            .order_by(StudyPlan.created_at.desc())
            .first()
        )
        if not active_plan:
            raise HTTPException(status_code=404, detail="No active study plan found.")
        target_plan_id = active_plan.id

    return AnalyticsService.get_progress_overview(db, student.id, target_plan_id)

@router.get("/modules", response_model=List[ModuleProgress])
def get_module_progress(
    plan_id: Optional[str] = None,
    student: StudentProfile = Depends(require_student),
    db: Session = Depends(get_db)
):
    overview = get_progress_overview(plan_id, student, db)
    return overview.modules_progress

@router.get("/weekly", response_model=List[DailyStudyMetric])
def get_weekly_metrics(
    plan_id: Optional[str] = None,
    student: StudentProfile = Depends(require_student),
    db: Session = Depends(get_db)
):
    overview = get_progress_overview(plan_id, student, db)
    return overview.weekly_breakdown

