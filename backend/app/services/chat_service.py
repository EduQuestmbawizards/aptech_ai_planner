import os
import uuid
import re
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Tuple
from fastapi import UploadFile, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc, func

from app.models.user import User, UserRole, StudentProfile
from app.models.chat import ChatConversation, ChatMessage


UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "uploads", "chat_attachments")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Strict File Validation Rules
MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024  # 15 MB

ALLOWED_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_PDF_EXTS = {".pdf"}
ALLOWED_DOC_EXTS = {".doc", ".docx", ".xls", ".xlsx", ".txt", ".csv"}

BLOCKED_VIDEO_EXTS = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".3gp", ".wmv", ".flv", ".m4v", ".ts"}


def validate_and_save_attachment(file: UploadFile) -> Tuple[str, str, str, int]:
    """
    Validates uploaded chat attachment:
    - Strictly blocks all video formats
    - Validates allowed extensions (Images, PDFs, Documents)
    - Validates file size (Max 15MB)
    Returns: (attachment_url, original_filename, attachment_type, file_size_bytes)
    """
    filename = file.filename or "attachment"
    _, ext = os.path.splitext(filename)
    ext = ext.lower()

    # 1. Strictly block video formats
    if ext in BLOCKED_VIDEO_EXTS or (file.content_type and file.content_type.lower().startswith("video/")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Video files are strictly not permitted. You can only share images, PDFs, and documents."
        )

    # 2. Categorize allowed types
    if ext in ALLOWED_IMAGE_EXTS:
        attachment_type = "IMAGE"
    elif ext in ALLOWED_PDF_EXTS:
        attachment_type = "PDF"
    elif ext in ALLOWED_DOC_EXTS:
        attachment_type = "DOCUMENT"
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '{ext}'. Allowed: Images (.jpg, .png, .webp), PDFs (.pdf), and Documents (.docx, .xlsx, .txt)."
        )

    # 3. Read content and enforce size limit
    try:
        content = file.file.read()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Failed to read uploaded file: {str(e)}")

    file_size = len(content)
    if file_size > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File exceeds maximum allowed size of 15MB (Size: {file_size / (1024 * 1024):.2f}MB)."
        )

    # 4. Save to disk with safe UUID filename
    safe_name = re.sub(r'[^a-zA-Z0-9_\.-]', '_', filename)
    saved_filename = f"{uuid.uuid4().hex}_{safe_name}"
    file_path = os.path.join(UPLOAD_DIR, saved_filename)

    with open(file_path, "wb") as f:
        f.write(content)

    attachment_url = f"/api/chat/attachments/{saved_filename}"
    return attachment_url, filename, attachment_type, file_size


def _dt_sort_key(dt: Optional[datetime]) -> float:
    if not dt:
        return 0.0
    try:
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc).timestamp()
        return dt.timestamp()
    except Exception:
        return 0.0


class ChatService:

    @staticmethod
    def get_or_create_conversation(db: Session, student_id: str, admin_id: str) -> ChatConversation:
        """Finds existing 1-to-1 conversation between student and admin, or creates a new one."""
        student = db.query(User).filter(User.id == student_id, User.role == UserRole.STUDENT.value).first()
        if not student:
            raise HTTPException(status_code=404, detail="Student user not found.")

        admin = db.query(User).filter(User.id == admin_id, User.role.in_([UserRole.ADMIN.value, UserRole.SUPER_ADMIN.value])).first()
        if not admin:
            raise HTTPException(status_code=404, detail="Admin user not found.")

        conv = db.query(ChatConversation).filter(
            ChatConversation.student_id == student_id,
            ChatConversation.admin_id == admin_id
        ).first()

        if not conv:
            conv = ChatConversation(
                student_id=student_id,
                admin_id=admin_id,
                last_message_at=datetime.now(timezone.utc)
            )
            db.add(conv)
            db.commit()
            db.refresh(conv)

        return conv

    @staticmethod
    def list_admins_for_student(db: Session, student_id: str) -> List[Dict[str, Any]]:
        """List all active admin/mentor users for the student to start or continue a conversation with."""
        admins = db.query(User).filter(User.role.in_([UserRole.ADMIN.value, UserRole.SUPER_ADMIN.value]), User.is_active == True).all()

        results = []
        for adm in admins:
            conv = db.query(ChatConversation).filter(
                ChatConversation.student_id == student_id,
                ChatConversation.admin_id == adm.id
            ).first()

            unread_count = 0
            last_msg = None
            if conv:
                unread_count = db.query(ChatMessage).filter(
                    ChatMessage.conversation_id == conv.id,
                    ChatMessage.sender_id != student_id,
                    ChatMessage.is_read == False
                ).count()
                last_msg = db.query(ChatMessage).filter(
                    ChatMessage.conversation_id == conv.id
                ).order_by(ChatMessage.created_at.desc()).first()

            results.append({
                "admin": {
                    "id": adm.id,
                    "full_name": adm.full_name,
                    "email": adm.email,
                    "role": adm.role,
                },
                "conversation_id": conv.id if conv else None,
                "unread_count": unread_count,
                "last_message_at": conv.last_message_at if conv else None,
                "last_message_text": last_msg.message_text if last_msg else (f"[Attachment: {last_msg.attachment_name}]" if last_msg and last_msg.attachment_name else None)
            })

        # Sort: conversations with messages first, then alphabetical by admin name
        results.sort(key=lambda x: (x["last_message_at"] is not None, _dt_sort_key(x["last_message_at"])), reverse=True)
        return results

    @staticmethod
    def list_students_for_admin(db: Session, admin_id: str, search: Optional[str] = None) -> List[Dict[str, Any]]:
        """List all students for the admin with their conversation status, last message, and unread badges."""
        query = db.query(User).filter(User.role == UserRole.STUDENT.value, User.is_active == True)

        if search and search.strip():
            s = f"%{search.strip()}%"
            query = query.filter(or_(User.full_name.ilike(s), User.email.ilike(s)))

        students = query.order_by(User.full_name.asc()).all()

        results = []
        for st in students:
            conv = db.query(ChatConversation).filter(
                ChatConversation.student_id == st.id,
                ChatConversation.admin_id == admin_id
            ).first()

            unread_count = 0
            last_msg = None
            if conv:
                unread_count = db.query(ChatMessage).filter(
                    ChatMessage.conversation_id == conv.id,
                    ChatMessage.sender_id != admin_id,
                    ChatMessage.is_read == False
                ).count()
                last_msg = db.query(ChatMessage).filter(
                    ChatMessage.conversation_id == conv.id
                ).order_by(ChatMessage.created_at.desc()).first()

            results.append({
                "student": {
                    "id": st.id,
                    "full_name": st.full_name,
                    "email": st.email,
                    "role": st.role,
                    "aptech_student_id": st.student_profile.aptech_student_id if st.student_profile else None
                },
                "conversation_id": conv.id if conv else None,
                "unread_count": unread_count,
                "last_message_at": conv.last_message_at if conv else None,
                "last_message_text": last_msg.message_text if last_msg else (f"[Attachment: {last_msg.attachment_name}]" if last_msg and last_msg.attachment_name else None)
            })

        # Sort: unread first, then recent messages, then others
        results.sort(key=lambda x: (x["unread_count"] > 0, _dt_sort_key(x["last_message_at"])), reverse=True)
        return results

    @staticmethod
    def get_messages(db: Session, conversation_id: str, current_user_id: str) -> List[ChatMessage]:
        """Fetch all messages for a conversation in chronological order (oldest to newest)."""
        conv = db.query(ChatConversation).filter(ChatConversation.id == conversation_id).first()
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found.")

        # Ensure user is either the student or the admin in this conversation
        if conv.student_id != current_user_id and conv.admin_id != current_user_id:
            # If current user is an admin, allow viewing
            cur_user = db.query(User).filter(User.id == current_user_id).first()
            if not cur_user or cur_user.role not in (UserRole.ADMIN.value, UserRole.SUPER_ADMIN.value):
                raise HTTPException(status_code=403, detail="You do not have access to this conversation.")

        messages = db.query(ChatMessage).filter(
            ChatMessage.conversation_id == conversation_id
        ).order_by(ChatMessage.created_at.asc()).all()

        return messages

    @staticmethod
    def send_message(
        db: Session,
        conversation_id: str,
        sender_id: str,
        message_text: Optional[str] = None,
        file: Optional[UploadFile] = None
    ) -> ChatMessage:
        """Send a message with optional attachment (validates file types strictly)."""
        conv = db.query(ChatConversation).filter(ChatConversation.id == conversation_id).first()
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found.")

        # Security check: Sender must be a participant or an admin
        sender = db.query(User).filter(User.id == sender_id).first()
        if not sender:
            raise HTTPException(status_code=404, detail="Sender user not found.")

        if sender.role == UserRole.STUDENT.value and conv.student_id != sender_id:
            raise HTTPException(status_code=403, detail="Students cannot send messages to unauthorized conversations.")

        text_clean = message_text.strip() if message_text else None

        attachment_url = None
        attachment_name = None
        attachment_type = None
        file_size_bytes = None

        if file and file.filename:
            attachment_url, attachment_name, attachment_type, file_size_bytes = validate_and_save_attachment(file)

        if not text_clean and not attachment_url:
            raise HTTPException(status_code=400, detail="Cannot send an empty message without text or attachment.")

        now = datetime.now(timezone.utc)
        msg = ChatMessage(
            conversation_id=conversation_id,
            sender_id=sender_id,
            message_text=text_clean,
            attachment_url=attachment_url,
            attachment_name=attachment_name,
            attachment_type=attachment_type,
            file_size_bytes=file_size_bytes,
            is_read=False,
            created_at=now
        )
        db.add(msg)

        # Update conversation's last_message_at
        conv.last_message_at = now
        conv.updated_at = now

        db.commit()
        db.refresh(msg)
        return msg

    @staticmethod
    def mark_as_read(db: Session, conversation_id: str, reader_id: str) -> int:
        """Marks all unread messages from other sender in this conversation as read."""
        unread = db.query(ChatMessage).filter(
            ChatMessage.conversation_id == conversation_id,
            ChatMessage.sender_id != reader_id,
            ChatMessage.is_read == False
        ).all()

        count = len(unread)
        for m in unread:
            m.is_read = True

        db.commit()
        return count

    @staticmethod
    def get_total_unread_count(db: Session, user_id: str) -> int:
        """Returns total unread incoming messages for the given user."""
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return 0

        if user.role == UserRole.STUDENT.value:
            # Student receives messages from admin
            return (
                db.query(ChatMessage)
                .join(ChatConversation, ChatConversation.id == ChatMessage.conversation_id)
                .filter(
                    ChatConversation.student_id == user_id,
                    ChatMessage.sender_id != user_id,
                    ChatMessage.is_read == False
                )
                .count()
            )
        else:
            # Admin receives messages from students sent to them
            return (
                db.query(ChatMessage)
                .join(ChatConversation, ChatConversation.id == ChatMessage.conversation_id)
                .filter(
                    ChatConversation.admin_id == user_id,
                    ChatMessage.sender_id != user_id,
                    ChatMessage.is_read == False
                )
                .count()
            )
