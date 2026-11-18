import io
import pytest
from fastapi.testclient import TestClient
import openpyxl

from app.main import app
from app.services.profile_roadmap_service import parse_profile_roadmap_excel

client = TestClient(app)


def get_admin_token():
    res = client.post("/api/auth/login", json={
        "email": "admin@aptech.edu",
        "password": "AptechAdmin@2026!"
    })
    return res.json()["access_token"]


def get_student_token():
    res = client.post("/api/auth/login", json={
        "email": "student.demo@aptech.edu",
        "password": "StudentDemo@2026!"
    })
    return res.json()["access_token"]


def create_sample_roadmap_xlsx() -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Profile Plan"

    # Header
    ws.append(["Period / Month", "Main actions", "Milestones and outputs"])

    # Rows (including Excel date serial 46327 -> November 2026)
    ws.append([46327, "Clinical shadowing outreach & Research literature review", "Secured observer role at hospital"])
    ws.append(["December 2026", "Project CARE elderly home community drive", "Completed 15 hours volunteer drive"])
    ws.append(["January 2027", "Diamond Challenge business pitch draft", "Executive summary submitted"])

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_parse_profile_roadmap_excel_date_serial():
    xlsx_bytes = create_sample_roadmap_xlsx()
    items = parse_profile_roadmap_excel(xlsx_bytes)

    assert len(items) == 3
    # Check that 46327 was parsed to "November 2026"
    assert items[0]["period"] == "November 2026"
    assert "Clinical shadowing outreach" in items[0]["main_actions"]
    assert items[0]["milestones_outputs"] == "Secured observer role at hospital"

    assert items[1]["period"] == "December 2026"
    assert items[2]["period"] == "January 2027"


def test_profile_roadmap_admin_upload_and_student_flow():
    admin_token = get_admin_token()
    student_token = get_student_token()
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    student_headers = {"Authorization": f"Bearer {student_token}"}

    # 1. Get demo student ID
    students_res = client.get("/api/admin/students", headers=admin_headers)
    assert students_res.status_code == 200
    students_list = students_res.json()["items"]
    demo_student = next(s for s in students_list if s["email"] == "student.demo@aptech.edu")
    student_id = demo_student["id"]

    # 2. Upload Excel roadmap as Admin
    xlsx_bytes = create_sample_roadmap_xlsx()
    upload_res = client.post(
        "/api/profile-roadmap/upload-excel",
        headers=admin_headers,
        data={"student_id": student_id, "replace_existing": "true"},
        files={"file": ("profile_plan.xlsx", xlsx_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    )
    assert upload_res.status_code == 200
    summary = upload_res.json()
    assert summary["student_id"] == student_id
    assert len(summary["items"]) == 3
    assert summary["stats"]["total_items"] == 3
    assert summary["stats"]["completed"] == 0

    first_item_id = summary["items"][0]["id"]

    # 3. Admin logs meeting & marks completion
    complete_res = client.patch(
        f"/api/profile-roadmap/items/{first_item_id}/complete",
        headers=admin_headers,
        json={
            "meeting_topic": "Research Methodology & Doctor Shadowing Outreach",
            "session_date": "2026-11-17",
            "session_duration_minutes": 45,
            "meeting_notes": "Discussed primary research question. Literature review draft to be submitted by next week. Elderly home visit confirmed."
        }
    )
    assert complete_res.status_code == 200
    completed_item = complete_res.json()
    assert completed_item["status"] == "COMPLETED"
    assert completed_item["meeting_topic"] == "Research Methodology & Doctor Shadowing Outreach"
    assert completed_item["session_duration_minutes"] == 45
    assert "Discussed primary research question" in completed_item["meeting_notes"]

    # 4. Admin checks student roadmap detail
    detail_res = client.get(f"/api/profile-roadmap/students/{student_id}", headers=admin_headers)
    assert detail_res.status_code == 200
    detail_data = detail_res.json()
    assert detail_data["stats"]["completed"] == 1
    assert detail_data["stats"]["total_session_minutes"] == 45

    # 5. Student checks own roadmap
    my_res = client.get("/api/profile-roadmap/my", headers=student_headers)
    assert my_res.status_code == 200
    my_data = my_res.json()
    assert my_data["student_email"] == "student.demo@aptech.edu"
    assert len(my_data["items"]) == 3
    assert my_data["items"][0]["status"] == "COMPLETED"
    assert my_data["items"][0]["meeting_topic"] == "Research Methodology & Doctor Shadowing Outreach"
    assert "Discussed primary research question" in my_data["items"][0]["meeting_notes"]
