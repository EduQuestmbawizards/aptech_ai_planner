from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel

class AITutorQuestionRequest(BaseModel):
    course_id: Optional[str] = None
    topic_id: Optional[str] = None
    question: str
    conversation_history: Optional[List[Dict[str, str]]] = []

class AITutorResponse(BaseModel):
    answer: str
    key_takeaways: List[str] = []
    suggested_practice_questions: List[str] = []
    referenced_topics: List[str] = []
    model_used: str

class AIUsageMetricResponse(BaseModel):
    total_requests: int
    total_tokens: int
    prompt_tokens: int
    completion_tokens: int
    estimated_cost_usd: float
    by_feature: Dict[str, int] = {}

