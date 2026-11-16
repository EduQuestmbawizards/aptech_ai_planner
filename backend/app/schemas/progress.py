from typing import List, Dict, Any, Optional
from datetime import date
from pydantic import BaseModel

class ModuleProgress(BaseModel):
    module_id: str
    module_code: str
    title: str
    total_topics: int
    completed_topics: int
    completion_rate: float
    total_hours: float
    completed_hours: float

class DailyStudyMetric(BaseModel):
    day: str # e.g. "Mon", "Tue"
    date_str: str # e.g. "2026-11-03"
    planned_hours: float
    actual_hours: float

class ProgressOverview(BaseModel):
    overall_progress_percent: float
    total_syllabus_hours: float
    planned_hours: float
    actual_study_hours: float
    total_tasks: int
    completed_tasks: int
    pending_tasks: int
    missed_tasks: int
    current_streak_days: int
    target_completion_date: Optional[date]
    days_remaining: int
    modules_progress: List[ModuleProgress] = []
    weekly_breakdown: List[DailyStudyMetric] = []

