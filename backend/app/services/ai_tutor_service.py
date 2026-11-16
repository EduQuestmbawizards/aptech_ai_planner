import logging
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.course import Course, CourseTopic
from app.models.logs import AIUsageLog
from app.schemas.ai import AITutorResponse

logger = logging.getLogger(__name__)

class AITutorService:
    @staticmethod
    def answer_question(
        db: Session,
        user_id: str,
        course_id: str,
        topic_id: Optional[str],
        question: str,
        conversation_history: List[Dict[str, str]]
    ) -> AITutorResponse:
        course = db.query(Course).filter(Course.id == course_id).first()
        topic = db.query(CourseTopic).filter(CourseTopic.id == topic_id).first() if topic_id else None

        topic_context = f"Topic: {topic.title} ({topic.topic_code})\nDescription: {topic.description}\nSubtopics: {', '.join(topic.subtopics)}" if topic else "General course inquiries"

        # Check OpenAI key
        if settings.OPENAI_API_KEY and settings.OPENAI_API_KEY != "your-openai-api-key-here":
            try:
                from openai import OpenAI
                client = OpenAI(api_key=settings.OPENAI_API_KEY)

                system_prompt = f"""You are the official Aptech AI Learning Assistant for the course:
{course.name if course else 'Aptech Technical Track'}.

Current Study Context:
{topic_context}

Rules:
1. Explain technical concepts accurately, concisely and clearly.
2. Provide code snippets with explanations where relevant.
3. Conclude with 2-3 key takeaways and 2 suggested practical practice questions.
4. If a question is outside the syllabus, politely guide the student back to their course objectives.
Format your answer with standard markdown."""

                messages = [{"role": "system", "content": system_prompt}]
                for msg in (conversation_history or [])[-4:]:
                    messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})
                messages.append({"role": "user", "content": question})

                completion = client.chat.completions.create(
                    model=settings.OPENAI_MODEL,
                    messages=messages,
                    max_tokens=650,
                    temperature=0.6
                )

                ans_text = completion.choices[0].message.content
                usage = completion.usage
                prompt_toks = usage.prompt_tokens if usage else 250
                comp_toks = usage.completion_tokens if usage else 150
                cost = (prompt_toks * 0.00000015) + (comp_toks * 0.0000006)

                # Log usage
                ai_log = AIUsageLog(
                    user_id=user_id,
                    feature="AI_TUTOR",
                    model=settings.OPENAI_MODEL,
                    prompt_tokens=prompt_toks,
                    completion_tokens=comp_toks,
                    total_tokens=prompt_toks + comp_toks,
                    estimated_cost_usd=cost
                )
                db.add(ai_log)
                db.commit()

                return AITutorResponse(
                    answer=ans_text,
                    key_takeaways=[
                        "Review core syntax and architectural flow.",
                        "Practice with unit tests and hands-on code examples.",
                        "Validate corner cases against official documentation."
                    ],
                    suggested_practice_questions=[
                        f"How would you refactor this approach to improve maintainability?",
                        f"What edge cases could cause unexpected errors in production?"
                    ],
                    referenced_topics=[topic.title] if topic else [course.name if course else "Core Syllabus"],
                    model_used=settings.OPENAI_MODEL
                )
            except Exception as e:
                logger.warning(f"OpenAI tutor request failed: {str(e)}. Using fallback response engine.")

        # Fallback offline deterministic assistant
        fallback_answer = f"""### Aptech Course Guidance

**Course:** {course.name if course else 'Aptech Learning Program'}  
**Active Context:** {topic.title if topic else 'Curriculum Study'}

Regarding your inquiry: *" {question} "*

In the Aptech curriculum, this concept is centered on foundational mastery and hands-on industry application.

#### Key Principles:
1. **Clear Modular Design:** Separate concerns between state management, business logic and storage interfaces.
2. **Defensive Programming:** Always validate user inputs and API responses before processing.
3. **Deterministic Testing:** Write tests that assert expected outcomes under both standard and edge-case conditions.

*(Note: Real-time OpenAI generation is ready to connect once `OPENAI_API_KEY` is provided in `.env`).*"""

        return AITutorResponse(
            answer=fallback_answer,
            key_takeaways=[
                "Master core concepts step-by-step through scheduled daily tasks.",
                "Verify solutions with test cases before marking tasks complete.",
                "Consult course resources and documentation for standard conventions."
            ],
            suggested_practice_questions=[
                "What are the core trade-offs between synchronous and asynchronous operations here?",
                "How would you handle unexpected input exceptions gracefully?"
            ],
            referenced_topics=[topic.title] if topic else [course.name if course else "Aptech Syllabus"],
            model_used="deterministic-tutor-engine (dev/offline)"
        )

