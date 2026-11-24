import json
import logging
from datetime import date, datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from app.core.database import get_db
from app.models.user import User, StudentProfile, UserRole
from app.models.enrollment import Enrollment, EnrollmentStatus
from app.models.course import Course
from app.models.planner import StudyTask
from app.models.attendance import Attendance, AttendanceStatus
from app.models.profile_roadmap import ProfileRoadmapItem, ProfileSessionAttendance
from app.models.logs import AuditLog
from app.schemas.attendance import (
    AttendanceRecordSchema,
    BatchAttendanceRequest,
    AttendanceSummary,
    StudentAttendanceStatsResponse
)
from app.api.deps import require_admin, require_student, get_current_user

logger = logging.getLogger("aptech_planner")

router = APIRouter(prefix="/attendance", tags=["Attendance Management"])


def _calculate_summary(records: List[Attendance]) -> AttendanceSummary:
    total = len(records)
    present = sum(1 for r in records if r.status == AttendanceStatus.PRESENT.value)
    late = sum(1 for r in records if r.status == AttendanceStatus.LATE.value)
    absent = sum(1 for r in records if r.status == AttendanceStatus.ABSENT.value)
    excused = sum(1 for r in records if r.status == AttendanceStatus.EXCUSED.value)
    effective_present = present + (0.5 * late)
    base_denominator = total - excused if (total - excused) > 0 else total
    percentage = round((effective_present / base_denominator * 100), 1) if base_denominator > 0 else 100.0

    return AttendanceSummary(
        total_classes=total,
        present_count=present,
        absent_count=absent,
        late_count=late,
        excused_count=excused,
        percentage=percentage,
    )


def _serialize_record(a: Attendance) -> AttendanceRecordSchema:
    course = a.enrollment.course if a.enrollment and a.enrollment.course else None
    student_user = a.student.user if a.student and a.student.user else None
    marker_name = a.marker.full_name if a.marker else "Admin"

    return AttendanceRecordSchema(
        id=a.id,
        student_id=a.student_id,
        enrollment_id=a.enrollment_id,
        course_id=course.id if course else None,
        course_name=course.name if course else None,
        course_code=course.course_code if course else None,
        student_name=student_user.full_name if student_user else "Student",
        aptech_student_id=a.student.aptech_student_id if a.student else None,
        study_task_id=a.study_task_id,
        task_title=a.study_task.title if a.study_task else None,
        attendance_date=a.attendance_date,
        status=a.status,
        remarks=a.remarks,
        marked_by_name=marker_name,
        created_at=a.created_at,
    )


# -------------------------------------------------------------
# Student Route: Get My Attendance Stats & History
# -------------------------------------------------------------
@router.get("/my", response_model=StudentAttendanceStatsResponse)
def get_my_attendance(
    course_id: Optional[str] = None,
    student: StudentProfile = Depends(require_student),
    db: Session = Depends(get_db)
):
    query = db.query(Attendance).filter(Attendance.student_id == student.id)
    if course_id:
        query = query.join(Enrollment, Attendance.enrollment_id == Enrollment.id).filter(Enrollment.course_id == course_id)

    course_records = query.order_by(Attendance.attendance_date.desc()).all()
    all_record_schemas = [_serialize_record(r) for r in course_records]

    # Include Profile Building & Mentorship session attendances if not filtering for a specific academic course
    if not course_id:
        profile_sessions = (
            db.query(ProfileSessionAttendance)
            .filter(ProfileSessionAttendance.student_id == student.id)
            .order_by(ProfileSessionAttendance.session_date.desc())
            .all()
        )
        existing_dates = set()
        for s in profile_sessions:
            existing_dates.add(s.session_date)
            period_str = s.roadmap_item.period if s.roadmap_item else "Mentorship Track"
            marker_name = s.marker.full_name if s.marker else "Faculty Mentor"

            # Parse attachments list
            att_list = []
            raw_att = getattr(s, "attachments", None)
            if raw_att:
                try:
                    att_list = json.loads(raw_att)
                except Exception:
                    pass
            doc_url = getattr(s, "document_url", None)
            if doc_url and not att_list:
                att_list = [{
                    "url": doc_url,
                    "name": getattr(s, "document_name", None) or "Attached Document",
                    "type": getattr(s, "document_type", None),
                    "size_bytes": getattr(s, "document_size_bytes", None)
                }]

            all_record_schemas.append(
                AttendanceRecordSchema(
                    id=s.id,
                    student_id=s.student_id,
                    enrollment_id="",
                    course_id="PROFILE_BUILDING",
                    course_name="Profile Building & Mentorship",
                    course_code="PROFILE",
                    student_name=student.user.full_name if student.user else "Student",
                    aptech_student_id=student.aptech_student_id,
                    study_task_id=s.roadmap_item_id,
                    task_title=s.topic or f"Mentorship Session ({period_str})",
                    topic=s.topic,
                    description=s.description,
                    duration_minutes=s.duration_minutes,
                    attendance_date=s.session_date,
                    status=s.status,
                    remarks=s.remarks or s.description,
                    marked_by_name=marker_name,
                    document_url=doc_url,
                    document_name=getattr(s, "document_name", None),
                    document_type=getattr(s, "document_type", None),
                    document_size_bytes=getattr(s, "document_size_bytes", None),
                    attachments=att_list,
                    created_at=s.created_at
                )
            )

        # Include any completed roadmap items with MoM notes not yet in profile_sessions
        completed_items = (
            db.query(ProfileRoadmapItem)
            .filter(
                ProfileRoadmapItem.student_id == student.id,
                ProfileRoadmapItem.status == "COMPLETED",
                ProfileRoadmapItem.session_date.isnot(None),
                ProfileRoadmapItem.meeting_notes.isnot(None)
            )
            .all()
        )
        for item in completed_items:
            if item.session_date not in existing_dates:
                marker_name = item.marked_by or "Faculty Mentor"
                desc_text = item.meeting_notes.strip()
                dur = f" • {item.session_duration_minutes} mins" if item.session_duration_minutes else ""
                all_record_schemas.append(
                    AttendanceRecordSchema(
                        id=f"mom_{item.id}",
                        student_id=student.id,
                        enrollment_id="",
                        course_id="PROFILE_BUILDING",
                        course_name="Profile Building & Mentorship",
                        course_code="PROFILE",
                        student_name=student.user.full_name if student.user else "Student",
                        aptech_student_id=student.aptech_student_id,
                        study_task_id=item.id,
                        task_title=f"{item.meeting_topic or item.period} ({item.period})",
                        attendance_date=item.session_date,
                        status="PRESENT",
                        remarks=f"{desc_text}{dur}",
                        marked_by_name=marker_name,
                        created_at=item.completed_at or item.updated_at
                    )
                )

    # Sort all records by attendance_date descending
    all_record_schemas.sort(key=lambda r: r.attendance_date, reverse=True)

    # Calculate overall summary
    total = len(all_record_schemas)
    present = sum(1 for r in all_record_schemas if r.status == AttendanceStatus.PRESENT.value)
    late = sum(1 for r in all_record_schemas if r.status == AttendanceStatus.LATE.value)
    absent = sum(1 for r in all_record_schemas if r.status == AttendanceStatus.ABSENT.value)
    excused = sum(1 for r in all_record_schemas if r.status == AttendanceStatus.EXCUSED.value)
    effective_present = present + (0.5 * late)
    base_denominator = total - excused if (total - excused) > 0 else total
    percentage = round((effective_present / base_denominator * 100), 1) if base_denominator > 0 else 100.0

    summary = AttendanceSummary(
        total_classes=total,
        present_count=present,
        absent_count=absent,
        late_count=late,
        excused_count=excused,
        percentage=percentage,
    )

    return StudentAttendanceStatsResponse(
        summary=summary,
        records=all_record_schemas
    )


# -------------------------------------------------------------
# Admin Route: Get Batch Attendance Sheet for a Course & Date
# -------------------------------------------------------------
@router.get("/sheet", dependencies=[Depends(require_admin)])
def get_batch_attendance_sheet(
    course_id: str,
    target_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    att_date = target_date or date.today()

    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found.")

    # All active enrollments for this course
    enrollments = (
        db.query(Enrollment)
        .filter(Enrollment.course_id == course_id, Enrollment.status == EnrollmentStatus.ACTIVE.value)
        .all()
    )

    # Existing attendance records for this date
    existing_records = {
        a.enrollment_id: a
        for a in db.query(Attendance).filter(
            Attendance.enrollment_id.in_([e.id for e in enrollments]),
            Attendance.attendance_date == att_date
        ).all()
    }

    students_sheet = []
    for enr in enrollments:
        att = existing_records.get(enr.id)
        st = enr.student
        u = st.user if st else None

        # Calculate student's overall attendance % in this course
        all_student_records = db.query(Attendance).filter(Attendance.enrollment_id == enr.id).all()
        summary = _calculate_summary(all_student_records)

        students_sheet.append({
            "student_id": st.id if st else "",
            "enrollment_id": enr.id,
            "student_name": u.full_name if u else "Unknown",
            "student_email": u.email if u else "",
            "aptech_student_id": st.aptech_student_id if st else "",
            "access_type": getattr(enr, "access_type", "FULL"),
            "current_status": att.status if att else None, # None means not marked yet
            "remarks": att.remarks if att else None,
            "overall_attendance_pct": summary.percentage,
            "total_attended": summary.present_count + summary.late_count,
            "total_classes": summary.total_classes,
        })

    return {
        "course_id": course.id,
        "course_name": course.name,
        "course_code": course.course_code,
        "attendance_date": att_date.isoformat(),
        "total_enrolled": len(enrollments),
        "sheet": students_sheet,
    }


# -------------------------------------------------------------
# Admin Route: Batch Mark or Update Attendance
# -------------------------------------------------------------
@router.post("/batch", dependencies=[Depends(require_admin)])
def mark_batch_attendance(
    payload: BatchAttendanceRequest,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    if not payload.records:
        raise HTTPException(status_code=400, detail="No attendance records provided.")

    att_date = payload.attendance_date or date.today()
    valid_statuses = {s.value for s in AttendanceStatus}
    updated_count = 0
    created_count = 0

    for item in payload.records:
        status_clean = item.status.upper().strip()
        if status_clean not in valid_statuses:
            continue

        # Handle Profile Building students who do not have an academic enrollment
        if not item.enrollment_id or str(item.enrollment_id).startswith("pb_"):
            existing_pb = db.query(ProfileSessionAttendance).filter(
                ProfileSessionAttendance.student_id == item.student_id,
                ProfileSessionAttendance.session_date == att_date
            ).first()
            if existing_pb:
                existing_pb.status = status_clean
                if item.remarks:
                    existing_pb.remarks = item.remarks
                    existing_pb.description = item.remarks
                existing_pb.marked_by = admin_user.id
                existing_pb.updated_at = datetime.now(timezone.utc)
                updated_count += 1
            else:
                new_pb = ProfileSessionAttendance(
                    student_id=item.student_id,
                    session_date=att_date,
                    topic="Mentorship & Profile Building Class",
                    description=item.remarks or "Session attendance logged by faculty mentor",
                    duration_minutes=45,
                    status=status_clean,
                    remarks=item.remarks,
                    marked_by=admin_user.id
                )
                db.add(new_pb)
                created_count += 1
            continue

        existing = db.query(Attendance).filter(
            Attendance.enrollment_id == item.enrollment_id,
            Attendance.attendance_date == att_date
        ).first()

        if existing:
            existing.status = status_clean
            existing.remarks = item.remarks
            existing.marked_by = admin_user.id
            if item.study_task_id:
                existing.study_task_id = item.study_task_id
            existing.updated_at = datetime.now(timezone.utc)
            updated_count += 1
        else:
            new_att = Attendance(
                student_id=item.student_id,
                enrollment_id=item.enrollment_id,
                attendance_date=att_date,
                status=status_clean,
                remarks=item.remarks,
                study_task_id=item.study_task_id,
                marked_by=admin_user.id
            )
            db.add(new_att)
            created_count += 1

    db.commit()

    return {
        "success": True,
        "message": f"Saved attendance for {att_date}: {created_count} created, {updated_count} updated.",
        "created_count": created_count,
        "updated_count": updated_count,
    }


# -------------------------------------------------------------
# Admin Route: List All Students with Today's Attendance & Stats
# -------------------------------------------------------------
@router.get("/admin/students-overview", dependencies=[Depends(require_admin)])
def get_students_attendance_overview(
    search: Optional[str] = None,
    target_date: Optional[date] = None,
    course_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    att_date = target_date or date.today()

    query = (
        db.query(StudentProfile)
        .join(User, StudentProfile.user_id == User.id)
        .filter(User.role == UserRole.STUDENT.value)
    )

    if search:
        search_fmt = f"%{search.strip()}%"
        query = query.filter(
            or_(
                User.full_name.ilike(search_fmt),
                User.email.ilike(search_fmt),
                StudentProfile.aptech_student_id.ilike(search_fmt)
            )
        )

    if course_id:
        query = query.join(Enrollment, Enrollment.student_id == StudentProfile.id).filter(Enrollment.course_id == course_id)

    students = query.order_by(User.full_name.asc()).all()

    results = []
    for st in students:
        u = st.user
        if not u:
            continue

        # Active enrollments
        enrollments = []
        try:
            enrollments = [e for e in (st.enrollments or []) if getattr(e, "status", None) == EnrollmentStatus.ACTIVE.value]
        except Exception as enr_err:
            logger.warning(f"Error reading enrollments for student {st.id}: {enr_err}")
            try:
                db.rollback()
            except Exception:
                pass

        primary_enr = enrollments[0] if enrollments else None
        if not primary_enr:
            try:
                all_enrs = st.enrollments or []
                primary_enr = all_enrs[0] if all_enrs else None
            except Exception:
                try:
                    db.rollback()
                except Exception:
                    pass

        if not primary_enr:
            if getattr(st, "track_type", "COURSE") in ("PROFILE_BUILDING", "BOTH"):
                # Profile Building Student Overview
                profile_sessions = []
                try:
                    profile_sessions = (
                        db.query(ProfileSessionAttendance)
                        .filter(ProfileSessionAttendance.student_id == st.id)
                        .all()
                    )
                except Exception as pb_err:
                    logger.warning(f"Error reading profile sessions for {st.id}: {pb_err}")
                    try:
                        db.rollback()
                    except Exception:
                        pass

                today_session = next((s for s in profile_sessions if s.session_date == att_date), None)
                tot = len(profile_sessions)
                pres = sum(1 for s in profile_sessions if s.status == "PRESENT")
                lat = sum(1 for s in profile_sessions if s.status == "LATE")
                ab = sum(1 for s in profile_sessions if s.status == "ABSENT")
                ex = sum(1 for s in profile_sessions if s.status == "EXCUSED")
                eff = pres + 0.5 * lat
                den = (tot - ex) if (tot - ex) > 0 else tot
                pct = round((eff / den * 100), 1) if den > 0 else 100.0

                results.append({
                    "student_id": st.id,
                    "enrollment_id": f"pb_{st.id}",
                    "user_id": u.id,
                    "full_name": u.full_name or "Student",
                    "email": u.email or "",
                    "aptech_student_id": getattr(st, "aptech_student_id", "") or "",
                    "phone": getattr(st, "phone", "") or "",
                    "course_id": "PROFILE_BUILDING",
                    "course_name": "Profile Building & Mentorship",
                    "course_code": "PROFILE",
                    "access_type": "FULL",
                    "track_type": getattr(st, "track_type", "PROFILE_BUILDING"),
                    "current_status": today_session.status if today_session else None,
                    "remarks": (f"{today_session.topic}: {today_session.description}") if today_session else None,
                    "summary": AttendanceSummary(
                        total_classes=tot,
                        present_count=pres,
                        absent_count=ab,
                        late_count=lat,
                        excused_count=ex,
                        percentage=pct
                    ),
                })
            continue

        # Check attendance for target_date
        att_record = None
        all_records = []
        try:
            att_record = db.query(Attendance).filter(
                Attendance.enrollment_id == primary_enr.id,
                Attendance.attendance_date == att_date
            ).first()
            all_records = db.query(Attendance).filter(Attendance.enrollment_id == primary_enr.id).all()
        except Exception as att_err:
            logger.warning(f"Error querying attendance for enrollment {primary_enr.id}: {att_err}")
            try:
                db.rollback()
            except Exception:
                pass

        summary = _calculate_summary(all_records)
        course = getattr(primary_enr, "course", None)

        results.append({
            "student_id": st.id,
            "enrollment_id": primary_enr.id,
            "user_id": u.id,
            "full_name": u.full_name or "Student",
            "email": u.email or "",
            "aptech_student_id": getattr(st, "aptech_student_id", "") or "",
            "phone": getattr(st, "phone", "") or "",
            "course_id": course.id if course else None,
            "course_name": course.name if course else "Unknown",
            "course_code": course.course_code if course else "",
            "access_type": getattr(primary_enr, "access_type", "FULL"),
            "current_status": att_record.status if att_record else None,
            "remarks": att_record.remarks if att_record else None,
            "summary": summary,
        })

    return {
        "attendance_date": att_date.isoformat(),
        "total": len(results),
        "items": results
    }


# -------------------------------------------------------------
# Admin Route: Single Student Attendance History
# -------------------------------------------------------------
@router.get("/students/{student_id}", dependencies=[Depends(require_admin)])
def get_student_attendance_admin(
    student_id: str,
    db: Session = Depends(get_db)
):
    student = db.query(StudentProfile).filter(StudentProfile.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    course_records = db.query(Attendance).filter(Attendance.student_id == student_id).order_by(Attendance.attendance_date.desc()).all()
    all_schemas = [_serialize_record(r) for r in course_records]

    profile_sessions = (
        db.query(ProfileSessionAttendance)
        .filter(ProfileSessionAttendance.student_id == student_id)
        .order_by(ProfileSessionAttendance.session_date.desc())
        .all()
    )
    admin_existing_dates = set()
    for s in profile_sessions:
        admin_existing_dates.add(s.session_date)
        period_str = s.roadmap_item.period if s.roadmap_item else "Mentorship Track"
        marker_name = s.marker.full_name if s.marker else "Faculty Mentor"
        desc_text = (s.description or "").strip()
        rem_text = (s.remarks or "").strip()
        parts = []
        if desc_text:
            parts.append(desc_text)
        if s.duration_minutes:
            parts.append(f"{s.duration_minutes} mins")
        if rem_text and rem_text != desc_text:
            parts.append(f"Note: {rem_text}")
        formatted_remarks = " • ".join(parts) if parts else "Mentorship session attended"

        all_schemas.append(
            AttendanceRecordSchema(
                id=s.id,
                student_id=s.student_id,
                enrollment_id="",
                course_id="PROFILE_BUILDING",
                course_name="Profile Building & Mentorship",
                course_code="PROFILE",
                student_name=student.user.full_name if student.user else "Student",
                aptech_student_id=student.aptech_student_id,
                study_task_id=s.roadmap_item_id,
                task_title=f"{s.topic} ({period_str})",
                attendance_date=s.session_date,
                status=s.status,
                remarks=formatted_remarks,
                marked_by_name=marker_name,
                created_at=s.created_at
            )
        )

    # Include any completed roadmap items with MoM notes not yet in profile_sessions
    admin_completed_items = (
        db.query(ProfileRoadmapItem)
        .filter(
            ProfileRoadmapItem.student_id == student_id,
            ProfileRoadmapItem.status == "COMPLETED",
            ProfileRoadmapItem.session_date.isnot(None),
            ProfileRoadmapItem.meeting_notes.isnot(None)
        )
        .all()
    )
    for item in admin_completed_items:
        if item.session_date not in admin_existing_dates:
            marker_name = item.marked_by or "Faculty Mentor"
            desc_text = item.meeting_notes.strip()
            dur = f" • {item.session_duration_minutes} mins" if item.session_duration_minutes else ""
            all_schemas.append(
                AttendanceRecordSchema(
                    id=f"mom_{item.id}",
                    student_id=student.id,
                    enrollment_id="",
                    course_id="PROFILE_BUILDING",
                    course_name="Profile Building & Mentorship",
                    course_code="PROFILE",
                    student_name=student.user.full_name if student.user else "Student",
                    aptech_student_id=student.aptech_student_id,
                    study_task_id=item.id,
                    task_title=f"{item.meeting_topic or item.period} ({item.period})",
                    attendance_date=item.session_date,
                    status="PRESENT",
                    remarks=f"{desc_text}{dur}",
                    marked_by_name=marker_name,
                    created_at=item.completed_at or item.updated_at
                )
            )

    all_schemas.sort(key=lambda r: r.attendance_date, reverse=True)

    tot = len(all_schemas)
    pres = sum(1 for r in all_schemas if r.status == AttendanceStatus.PRESENT.value)
    lat = sum(1 for r in all_schemas if r.status == AttendanceStatus.LATE.value)
    ab = sum(1 for r in all_schemas if r.status == AttendanceStatus.ABSENT.value)
    ex = sum(1 for r in all_schemas if r.status == AttendanceStatus.EXCUSED.value)
    eff = pres + 0.5 * lat
    den = (tot - ex) if (tot - ex) > 0 else tot
    pct = round((eff / den * 100), 1) if den > 0 else 100.0

    summary = AttendanceSummary(
        total_classes=tot,
        present_count=pres,
        absent_count=ab,
        late_count=lat,
        excused_count=ex,
        percentage=pct
    )

    return {
        "student_id": student.id,
        "student_name": student.user.full_name if student.user else "Student",
        "aptech_student_id": student.aptech_student_id,
        "summary": summary,
        "records": all_schemas
    }

