from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class ChatUserBrief(BaseModel):
    id: str
    full_name: str
    email: str
    role: str
    aptech_student_id: Optional[str] = None

    model_config = {"from_attributes": True}


class ChatMessageResponse(BaseModel):
    id: str
    conversation_id: str
    sender_id: str
    sender_name: str
    sender_role: str
    message_text: Optional[str] = None
    attachment_url: Optional[str] = None
    attachment_name: Optional[str] = None
    attachment_type: Optional[str] = None  # 'IMAGE' | 'PDF' | 'DOCUMENT'
    file_size_bytes: Optional[int] = None
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ConversationBrief(BaseModel):
    id: str
    student_id: str
    student_name: str
    student_email: str
    student_aptech_id: Optional[str] = None
    admin_id: str
    admin_name: str
    admin_email: str
    last_message_at: datetime
    last_message: Optional[ChatMessageResponse] = None
    unread_count: int = 0

    model_config = {"from_attributes": True}


class StartConversationRequest(BaseModel):
    admin_id: Optional[str] = None
    student_id: Optional[str] = None


class UnreadCountResponse(BaseModel):
    total_unread: int
