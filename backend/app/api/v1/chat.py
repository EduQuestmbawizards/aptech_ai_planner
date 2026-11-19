import os
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User, UserRole
from app.api.deps import get_current_user, require_admin, require_student
from app.services.chat_service import ChatService, UPLOAD_DIR
from app.schemas.chat import (
    ChatMessageResponse,
    ConversationBrief,
    StartConversationRequest,
    UnreadCountResponse
)

router = APIRouter(prefix="/chat", tags=["Chat & Mentorship Messaging"])


def _serialize_message(msg) -> ChatMessageResponse:
    sender_name = msg.sender.full_name if msg.sender else "User"
    sender_role = msg.sender.role if msg.sender else "STUDENT"
    return ChatMessageResponse(
        id=msg.id,
        conversation_id=msg.conversation_id,
        sender_id=msg.sender_id,
        sender_name=sender_name,
        sender_role=sender_role,
        message_text=msg.message_text,
        attachment_url=msg.attachment_url,
        attachment_name=msg.attachment_name,
        attachment_type=msg.attachment_type,
        file_size_bytes=msg.file_size_bytes,
        is_read=msg.is_read,
        created_at=msg.created_at
    )


@router.get("/admins")
def get_admins_for_student(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Student retrieves list of faculty admins/mentors to chat with."""
    return ChatService.list_admins_for_student(db, current_user.id)


@router.get("/students")
def get_students_for_admin(
    search: Optional[str] = Query(None),
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Admin retrieves list of all students with recent message preview and unread status."""
    return ChatService.list_students_for_admin(db, admin_user.id, search=search)


@router.post("/conversations/start")
def start_conversation(
    payload: StartConversationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Starts or returns an existing conversation between a student and an admin.
    - If student calls: passes payload.admin_id.
    - If admin calls: passes payload.student_id.
    """
    if current_user.role == UserRole.STUDENT.value:
        student_id = current_user.id
        admin_id = payload.admin_id
        if not admin_id:
            # Default to first active admin
            first_admin = db.query(User).filter(User.role == UserRole.ADMIN.value, User.is_active == True).first()
            if not first_admin:
                raise HTTPException(status_code=404, detail="No faculty admin available.")
            admin_id = first_admin.id
    else:
        # Admin is initiating
        admin_id = current_user.id
        student_id = payload.student_id
        if not student_id:
            raise HTTPException(status_code=400, detail="student_id is required.")

    conv = ChatService.get_or_create_conversation(db, student_id=student_id, admin_id=admin_id)
    return {
        "conversation_id": conv.id,
        "student_id": conv.student_id,
        "admin_id": conv.admin_id,
        "created_at": conv.created_at
    }


@router.get("/conversations/{conversation_id}/messages", response_model=List[ChatMessageResponse])
def get_conversation_messages(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Fetches all messages in chronological order for the given conversation."""
    messages = ChatService.get_messages(db, conversation_id, current_user.id)
    # Automatically mark incoming unread messages as read
    ChatService.mark_as_read(db, conversation_id, current_user.id)
    return [_serialize_message(m) for m in messages]


@router.post("/conversations/{conversation_id}/messages", response_model=ChatMessageResponse)
def send_conversation_message(
    conversation_id: str,
    message_text: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Sends a message (with optional file attachment: Image, PDF, or Document).
    Strictly validates and blocks video formats!
    """
    msg = ChatService.send_message(
        db=db,
        conversation_id=conversation_id,
        sender_id=current_user.id,
        message_text=message_text,
        file=file
    )
    return _serialize_message(msg)


@router.post("/conversations/{conversation_id}/mark-read")
def mark_conversation_as_read(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Marks incoming messages in this conversation as read."""
    marked_count = ChatService.mark_as_read(db, conversation_id, current_user.id)
    return {"success": True, "marked_read": marked_count}


@router.get("/unread-count", response_model=UnreadCountResponse)
def get_unread_messages_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns total unread message count for the logged-in user."""
    count = ChatService.get_total_unread_count(db, current_user.id)
    return UnreadCountResponse(total_unread=count)


@router.get("/attachments/{filename}")
def get_chat_attachment(
    filename: str,
    current_user: User = Depends(get_current_user)
):
    """Serves uploaded chat media attachment safely."""
    # Sanitize filename
    safe_basename = os.path.basename(filename)
    file_path = os.path.join(UPLOAD_DIR, safe_basename)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Attachment file not found.")

    return FileResponse(file_path)
