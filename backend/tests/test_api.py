import pytest
import hmac
import hashlib
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"

def test_admin_login():
    response = client.post("/api/auth/login", json={
        "email": "admin@aptech.edu",
        "password": "AptechAdmin@2026!"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["role"] == "ADMIN"
    assert "access_token" in data

def test_student_login():
    response = client.post("/api/auth/login", json={
        "email": "student.demo@aptech.edu",
        "password": "StudentDemo@2026!"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["role"] == "STUDENT"
    assert data["aptech_student_id"] == "APT-MUM-2026-1001"

def test_invalid_login():
    response = client.post("/api/auth/login", json={
        "email": "nonexistent@aptech.edu",
        "password": "wrongpassword"
    })
    assert response.status_code == 401

def test_courses_catalogue():
    response = client.get("/api/courses")
    assert response.status_code == 200
    courses = response.json()
    assert len(courses) >= 14
    codes = [c["course_code"] for c in courses]
    assert "SAT-PREP" in codes
    assert "UCAT-PREP" in codes
    assert "ISAT-PREP" in codes
    assert "GMAT-PREP" in codes
    assert "TARA-PREP" in codes

def test_course_syllabus():
    # First get course id
    courses = client.get("/api/courses").json()
    course_id = courses[0]["id"]
    response = client.get(f"/api/courses/{course_id}/syllabus")
    assert response.status_code == 200
    data = response.json()
    assert "modules" in data
    assert len(data["modules"]) > 0

def test_student_protected_route_without_token():
    client.cookies.clear()
    response = client.get("/api/enrollments/my")
    assert response.status_code == 401

def test_admin_protected_route_with_student_token():
    # Log in as student
    st_login = client.post("/api/auth/login", json={
        "email": "student.demo@aptech.edu",
        "password": "StudentDemo@2026!"
    }).json()
    st_token = st_login["access_token"]

    # Student attempts to access admin dashboard
    response = client.get(
        "/api/admin/dashboard",
        headers={"Authorization": f"Bearer {st_token}"}
    )
    assert response.status_code == 403

def test_eduquest_integration_valid_hmac():
    payload = {
        "eduquest_registration_id": "EQ-TEST-100",
        "aptech_student_id": "APT-TEST-9999",
        "full_name": "Test Webhook Student",
        "email": "test.webhook@example.com",
        "phone": "+91 99999 88888",
        "course_code": "SAT-PREP",
        "payment_reference": "TXN_TEST_100",
        "additional_notes": "Unit test registration payload"
    }
    import json
    body_str = json.dumps(payload)
    sig = hmac.new(
        settings.EDUQUEST_INTEGRATION_SECRET.encode("utf-8"),
        body_str.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()

    response = client.post(
        "/api/integrations/eduquest/student-registration",
        content=body_str,
        headers={
            "Content-Type": "application/json",
            "X-EduQuest-Signature": sig
        }
    )
    assert response.status_code == 201
    res_data = response.json()
    assert res_data["success"] is True
    assert res_data["data"]["status"] == "PENDING_ADMIN_APPROVAL"

def test_forgot_password_nonexistent_email():
    response = client.post("/api/auth/forgot-password", json={
        "email": "nobody.exists.here@aptech.edu"
    })
    assert response.status_code == 404

def test_forgot_and_reset_password_flow(monkeypatch):
    captured = {}

    def fake_send(email, token, full_name="Student"):
        captured["email"] = email
        captured["token"] = token
        return True

    from app.services.email_service import EmailService
    monkeypatch.setattr(EmailService, "send_password_reset_email", staticmethod(fake_send))

    # 1. Request reset for demo student
    res = client.post("/api/auth/forgot-password", json={"email": "student.demo@aptech.edu"})
    assert res.status_code == 200
    assert res.json()["success"] is True
    assert "token" in captured

    token = captured["token"]

    # 2. Verify token endpoint
    verify_res = client.get("/api/auth/verify-reset-token", params={"token": token})
    assert verify_res.status_code == 200
    assert verify_res.json()["valid"] is True
    assert verify_res.json()["email"] == "student.demo@aptech.edu"

    # 3. Reset password
    reset_res = client.post("/api/auth/reset-password", json={
        "token": token,
        "new_password": "NewStudentPass@2026!"
    })
    assert reset_res.status_code == 200
    assert reset_res.json()["success"] is True

    # 4. Token cannot be reused
    reuse_res = client.get("/api/auth/verify-reset-token", params={"token": token})
    assert reuse_res.status_code == 400

    # 5. Restore demo password so other tests / demo user continue working
    res2 = client.post("/api/auth/forgot-password", json={"email": "student.demo@aptech.edu"})
    assert res2.status_code == 200
    restore_res = client.post("/api/auth/reset-password", json={
        "token": captured["token"],
        "new_password": "StudentDemo@2026!"
    })
    assert restore_res.status_code == 200

def test_student_courses_details_and_invoice_pdf():
    client.cookies.clear()
    login_res = client.post("/api/auth/login", json={
        "email": "student.demo@aptech.edu",
        "password": "StudentDemo@2026!"
    })
    assert login_res.status_code == 200
    headers = {"Authorization": f"Bearer {login_res.json()['access_token']}"}

    enr_res = client.get("/api/enrollments/my", headers=headers)
    assert enr_res.status_code == 200
    items = enr_res.json()["items"]
    assert len(items) > 0
    first = items[0]
    assert "invoice_number" in first
    assert "modules_summary" in first

    pdf_res = client.get(f"/api/enrollments/{first['enrollment_id']}/invoice/pdf", headers=headers)
    assert pdf_res.status_code == 200
    assert pdf_res.headers["content-type"] == "application/pdf"
    assert pdf_res.content.startswith(b"%PDF-1.4")
    assert b"%%EOF" in pdf_res.content

def test_admin_create_and_delete_student():
    client.cookies.clear()
    adm_login = client.post("/api/auth/login", json={
        "email": "admin@aptech.edu",
        "password": "AptechAdmin@2026!"
    })
    assert adm_login.status_code == 200
    headers = {"Authorization": f"Bearer {adm_login.json()['access_token']}"}

    courses = client.get("/api/courses").json()
    course_id = courses[0]["id"]

    import uuid
    suffix = uuid.uuid4().hex[:6]
    create_res = client.post("/api/admin/students", headers=headers, json={
        "full_name": f"Temp Delete Student {suffix}",
        "email": f"temp.delete.{suffix}@example.com",
        "phone": "+91 90000 00000",
        "aptech_student_id": f"APT-DEL-{suffix.upper()}",
        "course_id": course_id,
    })
    assert create_res.status_code == 201
    student_id = create_res.json()["student_id"]

    del_res = client.delete(f"/api/admin/students/{student_id}", headers=headers)
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True

    # Deleting again returns 404
    del_again = client.delete(f"/api/admin/students/{student_id}", headers=headers)
    assert del_again.status_code == 404


def test_free_trial_20_percent_and_admin_upgrade():
    import uuid
    import math
    from datetime import date, timedelta

    client.cookies.clear()
    courses = client.get("/api/courses").json()
    assert len(courses) > 0
    # Pick a course with enough hours/topics so total tasks >= 5
    course = max(courses, key=lambda c: c.get("topics_count", 0))

    suffix = uuid.uuid4().hex[:8]
    trial_email = f"trial.{suffix}@example.com"
    trial_password = "TrialUser@2026!"

    # 1. Self-service Trial Signup
    signup_res = client.post("/api/auth/trial-signup", json={
        "full_name": f"Trial Student {suffix}",
        "email": trial_email,
        "password": trial_password,
        "phone": "+91 98111 22333",
        "course_id": course["id"],
    })
    assert signup_res.status_code == 201
    signup_data = signup_res.json()
    assert signup_data["access_token"]
    assert signup_data["role"] == "STUDENT"

    # 2. Same Sign In endpoint works for Trial Student
    client.cookies.clear()
    login_res = client.post("/api/auth/login", json={
        "email": trial_email,
        "password": trial_password,
    })
    assert login_res.status_code == 200
    headers = {"Authorization": f"Bearer {login_res.json()['access_token']}"}

    # 3. Enrollment shows TRIAL access_type and PDF invoice is locked (403)
    my_enr = client.get("/api/enrollments/my", headers=headers).json()["items"][0]
    assert my_enr["access_type"] == "TRIAL"
    pdf_res = client.get(f"/api/enrollments/{my_enr['enrollment_id']}/invoice/pdf", headers=headers)
    assert pdf_res.status_code == 403

    # 4. Generate study plan -> auto-approved, 20% unlocked, 80% masked
    target = (date.today() + timedelta(days=90)).isoformat()
    gen_res = client.post("/api/plans/generate", headers=headers, json={
        "enrollment_id": my_enr["enrollment_id"],
        "target_completion_date": target,
        "requested_duration_days": 90,
        "daily_study_hours": 2.0,
        "available_days": ["MON", "TUE", "WED", "THU", "FRI", "SAT"],
        "preferred_learning_style": "BALANCED",
        "pace_preference": "STEADY",
    })
    assert gen_res.status_code == 200
    plan_id = gen_res.json()["id"]
    assert gen_res.json()["access_type"] == "TRIAL"
    assert gen_res.json()["approval_status"] == "APPROVED"

    detail = client.get(f"/api/plans/{plan_id}", headers=headers).json()
    tasks = detail["tasks"]
    assert len(tasks) >= 2
    expected_unlocked = max(1, math.ceil(len(tasks) * 0.20))
    unlocked = [t for t in tasks if not t["is_locked"]]
    locked = [t for t in tasks if t["is_locked"]]
    assert len(unlocked) == expected_unlocked
    if locked:
        assert all(t["title"].startswith("Locked Class") for t in locked)
        # Updating a locked task returns 403
        upd_locked = client.patch(f"/api/tasks/{locked[0]['id']}/status", headers=headers, json={"status": "COMPLETED"})
        assert upd_locked.status_code == 403

    # CSV export is locked (403)
    csv_res = client.get(f"/api/plans/{plan_id}/export", headers=headers)
    assert csv_res.status_code == 403

    # 5. Admin upgrades Trial student to FULL access
    client.cookies.clear()
    adm_login = client.post("/api/auth/login", json={
        "email": "admin@aptech.edu",
        "password": "AptechAdmin@2026!",
    })
    assert adm_login.status_code == 200
    adm_headers = {"Authorization": f"Bearer {adm_login.json()['access_token']}"}

    students_list = client.get(f"/api/admin/students?search={trial_email}", headers=adm_headers).json()["items"]
    assert len(students_list) == 1
    assert students_list[0]["has_trial_enrollment"] is True
    student_profile_id = students_list[0]["id"]

    up_res = client.patch(f"/api/admin/students/{student_profile_id}/upgrade-access", headers=adm_headers)
    assert up_res.status_code == 200
    assert up_res.json()["upgraded_count"] >= 1

    # 6. Trial student now has 100% unlocked tasks + CSV + Invoice PDF
    detail_after = client.get(f"/api/plans/{plan_id}", headers=headers).json()
    assert detail_after["access_type"] == "FULL"
    assert all(not t["is_locked"] for t in detail_after["tasks"])
    assert client.get(f"/api/plans/{plan_id}/export", headers=headers).status_code == 200
    assert client.get(f"/api/enrollments/{my_enr['enrollment_id']}/invoice/pdf", headers=headers).status_code == 200


def test_attendance_batch_marking_and_student_stats():
    import uuid
    from datetime import date

    client.cookies.clear()
    adm_login = client.post("/api/auth/login", json={
        "email": "admin@aptech.edu",
        "password": "AptechAdmin@2026!"
    })
    assert adm_login.status_code == 200
    adm_headers = {"Authorization": f"Bearer {adm_login.json()['access_token']}"}

    # 1. Fetch demo student & courses
    courses = client.get("/api/courses").json()
    assert len(courses) > 0
    course_id = courses[0]["id"]

    # 2. Admin retrieves batch attendance sheet
    today_str = date.today().isoformat()
    sheet_res = client.get(f"/api/attendance/sheet?course_id={course_id}&target_date={today_str}", headers=adm_headers)
    assert sheet_res.status_code == 200
    sheet_data = sheet_res.json()
    assert "sheet" in sheet_data

    # If demo student enrolled in course_id, we mark them PRESENT
    if sheet_data["sheet"]:
        first_student = sheet_data["sheet"][0]
        mark_res = client.post("/api/attendance/batch", headers=adm_headers, json={
            "attendance_date": today_str,
            "course_id": course_id,
            "records": [
                {
                    "student_id": first_student["student_id"],
                    "enrollment_id": first_student["enrollment_id"],
                    "status": "PRESENT",
                    "remarks": "On time and actively participated"
                }
            ]
        })
        assert mark_res.status_code == 200
        assert mark_res.json()["success"] is True

        # Admin gets student attendance detail
        st_att = client.get(f"/api/attendance/students/{first_student['student_id']}", headers=adm_headers)
        assert st_att.status_code == 200
        assert st_att.json()["summary"]["present_count"] >= 1

