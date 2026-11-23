import os
import uuid
import re
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Request, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.api.deps import get_current_user, require_admin
from app.models.user import User, StudentProfile, UserRole
from app.models.profile_roadmap import ProfileRoadmapItem, RoadmapItemStatus, ProfileSessionAttendance
from app.schemas.profile_roadmap import (
    ProfileRoadmapItemResponse,
    ProfileRoadmapItemUpdate,
    ProfileRoadmapCompleteRequest,
    ProfileRoadmapStatusUpdateRequest,
    ProfileRoadmapStudentSummary,
    ProfileRoadmapItemCreate,
    ProfileRoadmapStats,
    ProfileSessionAttendanceCreate,
    ProfileSessionAttendanceUpdate,
    ProfileSessionAttendanceResponse,
)
from app.services.profile_roadmap_service import (
    parse_profile_roadmap_excel,
    ProfileRoadmapService
)

logger = logging.getLogger("aptech_planner.api.profile_roadmap")

router = APIRouter(prefix="/profile-roadmap", tags=["Profile Building & Mentorship Roadmap"])


SESSION_DOCS_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))),
    "uploads",
    "session_documents"
)
os.makedirs(SESSION_DOCS_DIR, exist_ok=True)

ALLOWED_DOC_EXTS = {
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    ".txt", ".csv", ".rtf", ".odt", ".ods", ".odp",
    ".png", ".jpg", ".jpeg", ".webp"
}
MAX_DOC_SIZE_BYTES = 25 * 1024 * 1024  # 25 MB


def _serialize_session(s: ProfileSessionAttendance) -> ProfileSessionAttendanceResponse:
    marker_name = s.marker.full_name if s.marker else None
    period_str = s.roadmap_item.period if s.roadmap_item else None
    return ProfileSessionAttendanceResponse(
        id=s.id,
        student_id=s.student_id,
        roadmap_item_id=s.roadmap_item_id,
        period=period_str,
        session_date=s.session_date,
        topic=s.topic,
        description=s.description,
        duration_minutes=s.duration_minutes,
        status=s.status,
        remarks=s.remarks,
        marked_by=s.marked_by,
        marked_by_name=marker_name,
        document_url=getattr(s, "document_url", None),
        document_name=getattr(s, "document_name", None),
        document_type=getattr(s, "document_type", None),
        document_size_bytes=getattr(s, "document_size_bytes", None),
        created_at=s.created_at,
        updated_at=s.updated_at
    )


def _serialize_item(item: ProfileRoadmapItem) -> ProfileRoadmapItemResponse:
    sessions = [_serialize_session(s) for s in (item.sessions or [])]
    data = ProfileRoadmapItemResponse.model_validate(item)
    data.sessions = sessions
    return data


@router.post("/upload-excel", response_model=ProfileRoadmapStudentSummary)
async def upload_roadmap_excel(
    student_id: str = Form(...),
    replace_existing: bool = Form(True),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Admin uploads a student-specific .xlsx Profile Execution Plan.
    Parses months, actions, milestones, and provisions roadmap items.
    """
    if not file.filename.lower().endswith((".xlsx", ".xlsm")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only Excel (.xlsx) files are supported for profile roadmap upload."
        )

    student = db.query(StudentProfile).filter(StudentProfile.id == student_id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student profile with ID {student_id} not found."
        )

    file_bytes = await file.read()
    items = parse_profile_roadmap_excel(file_bytes)

    saved_items = ProfileRoadmapService.save_roadmap_for_student(
        db=db,
        student_id=student_id,
        items=items,
        replace_existing=replace_existing
    )

    stats = ProfileRoadmapService.get_stats_for_student(db, student_id)

    return ProfileRoadmapStudentSummary(
        student_id=student.id,
        student_name=student.user.full_name if student.user else "Unknown Student",
        student_email=student.user.email if student.user else "",
        aptech_student_id=student.aptech_student_id,
        track_type=student.track_type,
        stats=ProfileRoadmapStats(**stats),
        items=[_serialize_item(i) for i in saved_items]
    )


@router.get("/students", response_model=List[ProfileRoadmapStudentSummary])
def list_students_with_roadmaps(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Admin lists all students with their profile roadmap summary.
    """
    students = (
        db.query(StudentProfile)
        .join(User, StudentProfile.user_id == User.id)
        .filter(User.role == UserRole.STUDENT.value)
        .order_by(User.full_name.asc())
        .all()
    )

    summaries = []
    for s in students:
        items = ProfileRoadmapService.get_roadmap_for_student(db, s.id)
        stats = ProfileRoadmapService.get_stats_for_student(db, s.id)
        summaries.append(
            ProfileRoadmapStudentSummary(
                student_id=s.id,
                student_name=s.user.full_name if s.user else "Unknown Student",
                student_email=s.user.email if s.user else "",
                aptech_student_id=s.aptech_student_id,
                track_type=s.track_type,
                stats=ProfileRoadmapStats(**stats),
                items=[_serialize_item(i) for i in items]
            )
        )
    return summaries


@router.get("/students/{student_id}", response_model=ProfileRoadmapStudentSummary)
def get_student_roadmap(
    student_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Admin retrieves detailed month-by-month roadmap for a specific student.
    """
    student = db.query(StudentProfile).filter(StudentProfile.id == student_id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student profile not found."
        )

    items = ProfileRoadmapService.get_roadmap_for_student(db, student.id)
    stats = ProfileRoadmapService.get_stats_for_student(db, student.id)

    return ProfileRoadmapStudentSummary(
        student_id=student.id,
        student_name=student.user.full_name if student.user else "Unknown Student",
        student_email=student.user.email if student.user else "",
        aptech_student_id=student.aptech_student_id,
        track_type=student.track_type,
        stats=ProfileRoadmapStats(**stats),
        items=[_serialize_item(i) for i in items]
    )


@router.patch("/items/{item_id}", response_model=ProfileRoadmapItemResponse)
def update_roadmap_item(
    item_id: str,
    body: ProfileRoadmapItemUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Admin/Teacher updates roadmap item details:
    period, main_actions (what to study/do), milestones_outputs (deliverables/outputs), status, etc.
    """
    update_data = body.model_dump(exclude_unset=True)
    updated_item = ProfileRoadmapService.update_roadmap_item(
        db=db,
        item_id=item_id,
        update_data=update_data
    )
    return ProfileRoadmapItemResponse.model_validate(updated_item)


@router.patch("/items/{item_id}/complete", response_model=ProfileRoadmapItemResponse)
def complete_roadmap_item(
    item_id: str,
    body: ProfileRoadmapCompleteRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Admin marks a roadmap month/session as COMPLETED and logs Meeting Topic,
    Duration in minutes, Session Date, and Minutes of Meeting (MoM).
    """
    updated_item = ProfileRoadmapService.complete_roadmap_item(
        db=db,
        item_id=item_id,
        meeting_topic=body.meeting_topic,
        session_date=body.session_date,
        session_duration_minutes=body.session_duration_minutes,
        meeting_notes=body.meeting_notes,
        marked_by=admin.id
    )
    return ProfileRoadmapItemResponse.model_validate(updated_item)


@router.patch("/items/{item_id}/status", response_model=ProfileRoadmapItemResponse)
def update_roadmap_item_status(
    item_id: str,
    body: ProfileRoadmapStatusUpdateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Admin updates the status of a roadmap item (PENDING, IN_PROGRESS, COMPLETED).
    """
    updated_item = ProfileRoadmapService.update_item_status(
        db=db,
        item_id=item_id,
        new_status=body.status
    )
    return ProfileRoadmapItemResponse.model_validate(updated_item)


@router.post("/students/{student_id}/items", response_model=ProfileRoadmapItemResponse)
def add_manual_roadmap_item(
    student_id: str,
    body: ProfileRoadmapItemCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Admin manually adds a single roadmap item for a student.
    """
    student = db.query(StudentProfile).filter(StudentProfile.id == student_id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student profile not found."
        )

    item = ProfileRoadmapItem(
        student_id=student.id,
        period=body.period,
        order_index=body.order_index,
        main_actions=body.main_actions,
        milestones_outputs=body.milestones_outputs,
        status=body.status,
        meeting_topic=body.meeting_topic,
        session_date=body.session_date,
        session_duration_minutes=body.session_duration_minutes,
        meeting_notes=body.meeting_notes,
        marked_by=admin.id if body.status == RoadmapItemStatus.COMPLETED.value else None
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return ProfileRoadmapItemResponse.model_validate(item)


@router.delete("/items/{item_id}")
def delete_roadmap_item(
    item_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Admin deletes a single roadmap item.
    """
    item = db.query(ProfileRoadmapItem).filter(ProfileRoadmapItem.id == item_id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Roadmap item not found."
        )
    db.delete(item)
    db.commit()
    return {"message": "Roadmap item deleted successfully."}


@router.get("/my", response_model=ProfileRoadmapStudentSummary)
def get_my_profile_roadmap(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Student retrieves their own Profile Building Roadmap and logged MoM sessions.
    """
    student = db.query(StudentProfile).filter(StudentProfile.user_id == current_user.id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student profile not found for the logged in user."
        )

    items = ProfileRoadmapService.get_roadmap_for_student(db, student.id)
    stats = ProfileRoadmapService.get_stats_for_student(db, student.id)

    return ProfileRoadmapStudentSummary(
        student_id=student.id,
        student_name=current_user.full_name,
        student_email=current_user.email,
        aptech_student_id=student.aptech_student_id,
        track_type=student.track_type,
        stats=ProfileRoadmapStats(**stats),
        items=[_serialize_item(i) for i in items]
    )


# -------------------------------------------------------------
# Session Attendance & Class History Endpoints
# -------------------------------------------------------------

@router.post("/sessions/upload-document")
async def upload_session_document(
    file: UploadFile = File(...),
    admin: User = Depends(require_admin)
):
    """
    Admin uploads a session reference document (PDF, Word, Excel, PPT, Image, etc.)
    Max size: 25MB.
    Returns: document_url, document_name, document_size_bytes, document_type
    """
    filename = file.filename or "session_document"
    _, ext = os.path.splitext(filename)
    ext = ext.lower()

    if ext not in ALLOWED_DOC_EXTS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '{ext}'. Allowed: PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx), Text (.txt), and Images."
        )

    try:
        content = await file.read()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Failed to read file: {str(e)}")

    file_size = len(content)
    if file_size > MAX_DOC_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File exceeds maximum allowed size of 25MB (Size: {file_size / (1024 * 1024):.2f}MB)."
        )

    safe_name = re.sub(r'[^a-zA-Z0-9_\.-]', '_', filename)
    saved_filename = f"{uuid.uuid4().hex}_{safe_name}"
    file_path = os.path.join(SESSION_DOCS_DIR, saved_filename)

    with open(file_path, "wb") as f:
        f.write(content)

    doc_type = ext.replace(".", "").upper()
    document_url = f"/api/profile-roadmap/sessions/documents/{saved_filename}"

    return {
        "document_url": document_url,
        "document_name": filename,
        "document_type": doc_type,
        "document_size_bytes": file_size
    }


@router.get("/sessions/documents/{filename}")
def get_session_document(
    filename: str,
    request: Request,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Allows authenticated users (Admin, Super Admin, or Student) to download/view uploaded session documents.
    Accepts auth via:
    1. Authorization Bearer header
    2. Cookie 'access_token'
    3. Query parameter ?token=...
    """
    auth_token = None
    if request:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            auth_token = auth_header.split(" ")[1]
        elif "access_token" in request.cookies:
            auth_token = request.cookies.get("access_token")

    if not auth_token and token:
        auth_token = token

    if not auth_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required to access documents.")

    payload = decode_access_token(auth_token)
    if not payload or not payload.get("sub"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired authentication token.")

    safe_basename = os.path.basename(filename)
    file_path = os.path.join(SESSION_DOCS_DIR, safe_basename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session document file not found.")

    parts = safe_basename.split("_", 1)
    download_filename = parts[1] if len(parts) > 1 else safe_basename

    return FileResponse(
        file_path,
        filename=download_filename,
        media_type="application/octet-stream"
    )


@router.post("/students/{student_id}/sessions", response_model=ProfileSessionAttendanceResponse)
def log_session_attendance(
    student_id: str,
    body: ProfileSessionAttendanceCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Admin/Teacher logs attendance for a specific session with date, topic covered,
    description of what was taught, duration in minutes, and attendance status (PRESENT, etc.).
    Can optionally be linked to a specific roadmap month/item.
    """
    session = ProfileRoadmapService.log_session_attendance(
        db=db,
        student_id=student_id,
        roadmap_item_id=body.roadmap_item_id,
        session_date=body.session_date,
        topic=body.topic,
        description=body.description,
        duration_minutes=body.duration_minutes,
        status=body.status,
        remarks=body.remarks,
        marked_by=admin.id,
        document_url=body.document_url,
        document_name=body.document_name,
        document_type=body.document_type,
        document_size_bytes=body.document_size_bytes
    )
    return _serialize_session(session)


@router.get("/students/{student_id}/sessions", response_model=List[ProfileSessionAttendanceResponse])
def get_student_sessions(
    student_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Admin retrieves the complete historical log of all mentorship & profile building sessions
    for a student, ordered by session date descending.
    """
    sessions = ProfileRoadmapService.get_student_sessions(db, student_id)
    return [_serialize_session(s) for s in sessions]


@router.patch("/sessions/{session_id}", response_model=ProfileSessionAttendanceResponse)
def update_session_attendance(
    session_id: str,
    body: ProfileSessionAttendanceUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Admin updates a previously logged session (date, topic, description, duration, status, etc.).
    """
    update_data = body.model_dump(exclude_unset=True)
    session = ProfileRoadmapService.update_session_attendance(db, session_id, update_data)
    return _serialize_session(session)


@router.delete("/sessions/{session_id}")
def delete_session_attendance(
    session_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Admin deletes a logged session attendance record.
    """
    ProfileRoadmapService.delete_session_attendance(db, session_id)
    return {"message": "Session attendance deleted successfully."}


@router.get("/my/sessions", response_model=List[ProfileSessionAttendanceResponse])
def get_my_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Student retrieves their transparent, complete attendance and session history
    with date, topics taught, and faculty discussion notes.
    """
    student = db.query(StudentProfile).filter(StudentProfile.user_id == current_user.id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student profile not found."
        )

    sessions = ProfileRoadmapService.get_student_sessions(db, student.id)
    return [_serialize_session(s) for s in sessions]


