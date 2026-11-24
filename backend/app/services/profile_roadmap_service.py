import io
import json
import logging
from datetime import datetime, date, timezone
from typing import List, Dict, Any, Optional
import openpyxl
from openpyxl.utils.datetime import from_excel
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.profile_roadmap import ProfileRoadmapItem, RoadmapItemStatus, ProfileSessionAttendance
from app.models.user import StudentProfile

logger = logging.getLogger("aptech_planner.profile_roadmap")


def _to_date(val: Any) -> date:
    if isinstance(val, date):
        return val
    if isinstance(val, datetime):
        return val.date()
    if isinstance(val, str) and val.strip():
        try:
            return date.fromisoformat(val.strip()[:10])
        except Exception:
            try:
                return datetime.strptime(val.strip()[:10], "%Y-%m-%d").date()
            except Exception:
                return date.today()
    return date.today()


def _format_cell_value(val: Any) -> str:
    if val is None:
        return ""
    if isinstance(val, (datetime, date)):
        return val.strftime("%B %Y")
    if isinstance(val, (int, float)):
        # Check if it looks like an Excel serial date (e.g., > 35000 is year ~1995+)
        if 35000 <= val <= 70000:
            try:
                dt = from_excel(val)
                return dt.strftime("%B %Y")
            except Exception:
                pass
        # If whole number, format without decimal .0
        if isinstance(val, float) and val.is_integer():
            return str(int(val))
        return str(val)
    return str(val).strip()


def parse_profile_roadmap_excel(file_bytes: bytes) -> List[Dict[str, Any]]:
    """
    Parses a student's Profile Execution Plan (.xlsx).
    Handles Excel date serial conversions (e.g. 46327 -> November 2026),
    identifies headers (Period, Main Actions, Milestones & Outputs),
    and returns a normalized list of roadmap items.
    """
    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty Excel file provided."
        )

    try:
        wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
    except Exception as e:
        logger.error(f"Failed to load Excel workbook: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid or corrupted Excel file: {str(e)}"
        )

    sheet = wb.active
    if not sheet:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Excel file contains no active sheets."
        )

    rows = list(sheet.iter_rows(values_only=True))
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Excel sheet is empty."
        )

    # Detect header row and column indexes
    col_period = 0
    col_actions = 1
    col_milestones = -1
    header_row_index = -1

    for r_idx, row in enumerate(rows[:15]):
        row_str_lower = [str(c or "").strip().lower() for c in row]
        p_idx = -1
        a_idx = -1
        m_idx = -1

        for c_idx, cell_str in enumerate(row_str_lower):
            # Header cells are concise column titles, not multi-sentence paragraphs
            if not cell_str or len(cell_str) > 35:
                continue

            if any(k in cell_str for k in ["period", "month", "timeline", "duration", "timeframe"]):
                p_idx = c_idx
            elif any(k in cell_str for k in ["main action", "action", "activity", "activities", "task", "scope", "work"]):
                a_idx = c_idx
            elif any(k in cell_str for k in ["milestone", "output", "deliverable", "result", "outcome", "goal"]):
                m_idx = c_idx

        # If both period and actions matched in a row, this is definitively the header row
        if p_idx != -1 and a_idx != -1 and p_idx != a_idx:
            header_row_index = r_idx
            col_period = p_idx
            col_actions = a_idx
            col_milestones = m_idx
            break
        elif (p_idx != -1 or a_idx != -1) and header_row_index == -1:
            header_row_index = r_idx
            col_period = p_idx if p_idx != -1 else 0
            col_actions = a_idx if a_idx != -1 else 1
            if m_idx != -1:
                col_milestones = m_idx

    # Guard against accidental same column index
    if col_period == col_actions:
        col_period = 0
        col_actions = 1

    # If milestones/outputs column was not explicitly identified by header keywords,
    # but the sheet has 3 or more columns, automatically treat the first unused column
    # as the milestones & deliverables column
    if col_milestones == -1 and rows:
        first_row_len = len(rows[0])
        for possible_col in range(first_row_len):
            if possible_col not in (col_period, col_actions):
                col_milestones = possible_col
                break

    data_rows = rows[(header_row_index + 1):] if header_row_index != -1 else rows

    items: List[Dict[str, Any]] = []
    order_idx = 1

    for row in data_rows:
        if not row or all(c is None or str(c).strip() == "" for c in row):
            continue

        raw_period = row[col_period] if 0 <= col_period < len(row) else None
        raw_actions = row[col_actions] if 0 <= col_actions < len(row) else None
        raw_milestones = row[col_milestones] if 0 <= col_milestones < len(row) else None

        period_str = _format_cell_value(raw_period)
        actions_str = _format_cell_value(raw_actions)
        milestones_str = _format_cell_value(raw_milestones) if col_milestones != -1 else None

        # Skip rows where both period and main actions are empty
        if not period_str and not actions_str:
            continue

        # Skip repeated header row
        if period_str.strip().lower() in ["period", "month", "period / month", "timeline", "time period"]:
            continue

        # Skip introductory / explanatory preamble rows (sentences > 45 chars in period column)
        if len(period_str) > 45 and not any(m in period_str.lower() for m in ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]):
            continue

        # If period is empty but actions exists, supply a fallback
        if not period_str:
            period_str = f"Month {order_idx}"

        # If actions is empty, fallback to milestones or placeholder
        if not actions_str:
            actions_str = milestones_str if milestones_str else "Mentorship & Profile Building Milestones"

        items.append({
            "order_index": order_idx,
            "period": period_str,
            "main_actions": actions_str,
            "milestones_outputs": milestones_str if milestones_str else None,
            "status": RoadmapItemStatus.PENDING.value
        })
        order_idx += 1

    if not items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid roadmap items could be extracted from the Excel sheet. Ensure columns contain 'Period / Month', 'Main Actions', and 'Milestones and Outputs'."
        )

    return items


class ProfileRoadmapService:
    @staticmethod
    def save_roadmap_for_student(
        db: Session,
        student_id: str,
        items: List[Dict[str, Any]],
        replace_existing: bool = True
    ) -> List[ProfileRoadmapItem]:
        # Verify student exists
        student = db.query(StudentProfile).filter(StudentProfile.id == student_id).first()
        if not student:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Student profile with ID {student_id} not found."
            )

        # Update track_type if it is still only COURSE
        if student.track_type == "COURSE":
            student.track_type = "BOTH"
            db.add(student)

        if replace_existing:
            db.query(ProfileRoadmapItem).filter(ProfileRoadmapItem.student_id == student_id).delete()
            db.flush()

        created_records = []
        for item_data in items:
            roadmap_item = ProfileRoadmapItem(
                student_id=student_id,
                period=item_data.get("period", ""),
                order_index=item_data.get("order_index", 1),
                main_actions=item_data.get("main_actions", ""),
                milestones_outputs=item_data.get("milestones_outputs"),
                status=item_data.get("status", RoadmapItemStatus.PENDING.value)
            )
            db.add(roadmap_item)
            created_records.append(roadmap_item)

        db.commit()
        for r in created_records:
            db.refresh(r)
        return created_records

    @staticmethod
    def get_roadmap_for_student(db: Session, student_id: str) -> List[ProfileRoadmapItem]:
        return (
            db.query(ProfileRoadmapItem)
            .filter(ProfileRoadmapItem.student_id == student_id)
            .order_index_by() if hasattr(ProfileRoadmapItem, "order_index_by") else
            db.query(ProfileRoadmapItem)
            .filter(ProfileRoadmapItem.student_id == student_id)
            .order_by(ProfileRoadmapItem.order_index.asc())
            .all()
        )

    @staticmethod
    def update_roadmap_item(
        db: Session,
        item_id: str,
        update_data: Dict[str, Any]
    ) -> ProfileRoadmapItem:
        item = db.query(ProfileRoadmapItem).filter(ProfileRoadmapItem.id == item_id).first()
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Roadmap item with ID {item_id} not found."
            )

        allowed_fields = [
            "period",
            "order_index",
            "main_actions",
            "milestones_outputs",
            "status",
            "meeting_topic",
            "session_date",
            "session_duration_minutes",
            "meeting_notes",
        ]

        for field in allowed_fields:
            if field in update_data and update_data[field] is not None:
                val = update_data[field]
                if isinstance(val, str):
                    val = val.strip()
                setattr(item, field, val)

        if "status" in update_data and update_data["status"] is not None:
            new_status = update_data["status"]
            if new_status == RoadmapItemStatus.COMPLETED.value and not item.completed_at:
                item.completed_at = datetime.now(timezone.utc)
            elif new_status != RoadmapItemStatus.COMPLETED.value:
                item.completed_at = None

        db.commit()
        db.refresh(item)
        return item

    @staticmethod
    def complete_roadmap_item(
        db: Session,
        item_id: str,
        meeting_topic: Optional[str],
        session_date: Optional[str],
        session_duration_minutes: Optional[int],
        meeting_notes: Optional[str],
        marked_by: Optional[str] = None
    ) -> ProfileRoadmapItem:
        item = db.query(ProfileRoadmapItem).filter(ProfileRoadmapItem.id == item_id).first()
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Roadmap item with ID {item_id} not found."
            )

        item.status = RoadmapItemStatus.COMPLETED.value
        item.completed_at = datetime.now(timezone.utc)
        if meeting_topic is not None:
            item.meeting_topic = meeting_topic.strip()
        if session_date is not None:
            item.session_date = session_date.strip()
        if session_duration_minutes is not None:
            item.session_duration_minutes = session_duration_minutes
        if meeting_notes is not None:
            item.meeting_notes = meeting_notes.strip()
        if marked_by:
            item.marked_by = marked_by

        # If a session date is provided with this MoM, sync it with ProfileSessionAttendance
        # so it transparently surfaces in Attendance tables and history for the student
        if item.session_date:
            parsed_session_date = _to_date(item.session_date)
            session_att = db.query(ProfileSessionAttendance).filter(
                ProfileSessionAttendance.student_id == item.student_id,
                ProfileSessionAttendance.roadmap_item_id == item.id,
                ProfileSessionAttendance.session_date == parsed_session_date
            ).first()
            if not session_att:
                session_att = ProfileSessionAttendance(
                    student_id=item.student_id,
                    roadmap_item_id=item.id,
                    session_date=parsed_session_date,
                    topic=item.meeting_topic or f"Milestone Completion: {item.period}",
                    description=item.meeting_notes or "Milestone completed and MoM recorded.",
                    duration_minutes=item.session_duration_minutes or 60,
                    status="PRESENT",
                    remarks=item.meeting_notes,
                    marked_by=marked_by
                )
                db.add(session_att)
            else:
                if item.meeting_topic:
                    session_att.topic = item.meeting_topic
                if item.meeting_notes:
                    session_att.description = item.meeting_notes
                    session_att.remarks = item.meeting_notes
                if item.session_duration_minutes:
                    session_att.duration_minutes = item.session_duration_minutes
                session_att.status = "PRESENT"
                if marked_by:
                    session_att.marked_by = marked_by

        db.commit()
        db.refresh(item)
        return item

    @staticmethod
    def update_item_status(
        db: Session,
        item_id: str,
        new_status: str
    ) -> ProfileRoadmapItem:
        item = db.query(ProfileRoadmapItem).filter(ProfileRoadmapItem.id == item_id).first()
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Roadmap item with ID {item_id} not found."
            )

        valid_statuses = [s.value for s in RoadmapItemStatus]
        if new_status not in valid_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status '{new_status}'. Must be one of: {valid_statuses}"
            )

        item.status = new_status
        if new_status == RoadmapItemStatus.COMPLETED.value and not item.completed_at:
            item.completed_at = datetime.now(timezone.utc)
        elif new_status != RoadmapItemStatus.COMPLETED.value:
            item.completed_at = None

        db.commit()
        db.refresh(item)
        return item

    @staticmethod
    def log_session_attendance(
        db: Session,
        student_id: str,
        roadmap_item_id: Optional[str],
        session_date: date,
        topic: str,
        description: str,
        duration_minutes: int = 45,
        status: str = "PRESENT",
        remarks: Optional[str] = None,
        marked_by: Optional[str] = None,
        document_url: Optional[str] = None,
        document_name: Optional[str] = None,
        document_type: Optional[str] = None,
        document_size_bytes: Optional[int] = None,
        attachments: Optional[Any] = None
    ) -> ProfileSessionAttendance:
        student = db.query(StudentProfile).filter(StudentProfile.id == student_id).first()
        if not student:
            raise HTTPException(
                status_code=404,
                detail=f"Student profile with ID {student_id} not found."
            )

        roadmap_item = None
        if roadmap_item_id:
            roadmap_item = db.query(ProfileRoadmapItem).filter(
                ProfileRoadmapItem.id == roadmap_item_id,
                ProfileRoadmapItem.student_id == student_id
            ).first()

        # Handle multiple attachments JSON serialization
        attachments_json = None
        if attachments:
            clean_att = []
            for a in attachments:
                if hasattr(a, "model_dump"):
                    clean_att.append(a.model_dump())
                elif hasattr(a, "dict"):
                    clean_att.append(a.dict())
                elif isinstance(a, dict):
                    clean_att.append(a)
            if clean_att:
                attachments_json = json.dumps(clean_att)
                if not document_url and clean_att[0].get("url"):
                    document_url = clean_att[0].get("url")
                    document_name = clean_att[0].get("name")
                    document_type = clean_att[0].get("type")
                    document_size_bytes = clean_att[0].get("size_bytes")

        session = ProfileSessionAttendance(
            student_id=student_id,
            roadmap_item_id=roadmap_item.id if roadmap_item else None,
            session_date=_to_date(session_date),
            topic=topic.strip(),
            description=description.strip(),
            duration_minutes=duration_minutes,
            status=status.upper().strip(),
            remarks=remarks.strip() if remarks else None,
            marked_by=marked_by,
            document_url=document_url.strip() if document_url else None,
            document_name=document_name.strip() if document_name else None,
            document_type=document_type.strip() if document_type else None,
            document_size_bytes=document_size_bytes,
            attachments=attachments_json
        )
        db.add(session)

        # If roadmap item is attached and currently PENDING, mark it IN_PROGRESS
        if roadmap_item and roadmap_item.status == RoadmapItemStatus.PENDING.value:
            roadmap_item.status = RoadmapItemStatus.IN_PROGRESS.value

        db.commit()
        db.refresh(session)
        return session

    @staticmethod
    def get_student_sessions(db: Session, student_id: str) -> List[ProfileSessionAttendance]:
        return (
            db.query(ProfileSessionAttendance)
            .filter(ProfileSessionAttendance.student_id == student_id)
            .order_by(ProfileSessionAttendance.session_date.desc(), ProfileSessionAttendance.created_at.desc())
            .all()
        )

    @staticmethod
    def update_session_attendance(
        db: Session,
        session_id: str,
        update_data: Dict[str, Any]
    ) -> ProfileSessionAttendance:
        session = db.query(ProfileSessionAttendance).filter(ProfileSessionAttendance.id == session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session attendance record not found.")

        if "attachments" in update_data:
            att_raw = update_data.pop("attachments")
            if att_raw is not None:
                clean_att = []
                for a in att_raw:
                    if hasattr(a, "model_dump"):
                        clean_att.append(a.model_dump())
                    elif hasattr(a, "dict"):
                        clean_att.append(a.dict())
                    elif isinstance(a, dict):
                        clean_att.append(a)
                session.attachments = json.dumps(clean_att) if clean_att else None
                if clean_att and clean_att[0].get("url"):
                    session.document_url = clean_att[0].get("url")
                    session.document_name = clean_att[0].get("name")
                    session.document_type = clean_att[0].get("type")
                    session.document_size_bytes = clean_att[0].get("size_bytes")
            else:
                session.attachments = None

        for field, val in update_data.items():
            if val is not None and hasattr(session, field):
                if field == "session_date":
                    val = _to_date(val)
                elif isinstance(val, str):
                    val = val.strip()
                setattr(session, field, val)

        session.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(session)
        return session

    @staticmethod
    def delete_session_attendance(db: Session, session_id: str) -> bool:
        session = db.query(ProfileSessionAttendance).filter(ProfileSessionAttendance.id == session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session attendance record not found.")
        db.delete(session)
        db.commit()
        return True

    @staticmethod
    def get_stats_for_student(db: Session, student_id: str) -> Dict[str, Any]:
        items = (
            db.query(ProfileRoadmapItem)
            .filter(ProfileRoadmapItem.student_id == student_id)
            .order_by(ProfileRoadmapItem.order_index.asc())
            .all()
        )
        total = len(items)
        completed = sum(1 for i in items if i.status == RoadmapItemStatus.COMPLETED.value)
        in_progress = sum(1 for i in items if i.status == RoadmapItemStatus.IN_PROGRESS.value)
        pending = sum(1 for i in items if i.status == RoadmapItemStatus.PENDING.value)

        # Sum duration from profile_session_attendances
        sessions = (
            db.query(ProfileSessionAttendance)
            .filter(ProfileSessionAttendance.student_id == student_id)
            .all()
        )
        total_sessions = len(sessions)
        session_duration = sum((s.duration_minutes or 0) for s in sessions if s.status == "PRESENT")

        # Fallback to items meeting duration if no sessions logged yet
        if total_sessions == 0:
            session_duration = sum((i.session_duration_minutes or 0) for i in items if i.status == RoadmapItemStatus.COMPLETED.value)
            total_sessions = completed

        percentage = round((completed / total * 100), 1) if total > 0 else 0.0

        return {
            "total_items": total,
            "completed": completed,
            "in_progress": in_progress,
            "pending": pending,
            "completion_percentage": percentage,
            "total_session_minutes": session_duration,
            "total_sessions_count": total_sessions
        }

