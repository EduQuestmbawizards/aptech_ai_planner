import pytest
from datetime import date, timedelta
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_planner_onboarding_and_task_lifecycle():
    client.cookies.clear()
    # 1. Login as demo student
    login_res = client.post("/api/auth/login", json={
        "email": "student.demo@aptech.edu",
        "password": "StudentDemo@2026!"
    })
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Get student's enrollments
    enr_res = client.get("/api/enrollments/my", headers=headers)
    assert enr_res.status_code == 200
    enrollments = enr_res.json()["items"]
    assert len(enrollments) > 0
    enrollment_id = enrollments[0]["enrollment_id"]

    # 3. Test capacity feasibility preview
    target_date = (date.today() + timedelta(days=120)).isoformat()
    preview_res = client.post("/api/plans/preview", headers=headers, json={
        "enrollment_id": enrollment_id,
        "target_completion_date": target_date,
        "requested_duration_days": 120,
        "daily_study_hours": 3.0,
        "available_days": ["MON", "TUE", "WED", "THU", "FRI", "SAT"],
        "preferred_learning_style": "BALANCED",
        "learning_goals": ["Prepare for Full Stack Web Developer Job"],
        "known_topics": [],
        "weak_topics": []
    })
    assert preview_res.status_code == 200
    preview_data = preview_res.json()
    assert preview_data["total_available_hours"] > 0
    assert "is_feasible" in preview_data

    # 4. Generate study plan
    gen_res = client.post("/api/plans/generate", headers=headers, json={
        "enrollment_id": enrollment_id,
        "target_completion_date": target_date,
        "requested_duration_days": 120,
        "daily_study_hours": 3.0,
        "available_days": ["MON", "TUE", "WED", "THU", "FRI", "SAT"],
        "preferred_learning_style": "BALANCED",
        "learning_goals": ["Full-Stack mastery"],
        "known_topics": [],
        "weak_topics": []
    })
    assert gen_res.status_code == 200
    plan_data = gen_res.json()
    assert plan_data["total_tasks"] > 0
    plan_id = plan_data["id"]

    # 5. Fetch current plan
    current_res = client.get("/api/plans/current", headers=headers)
    assert current_res.status_code == 200
    assert current_res.json()["id"] == plan_id

    # 6. Fetch plan tasks
    tasks_res = client.get(f"/api/tasks?plan_id={plan_id}", headers=headers)
    assert tasks_res.status_code == 200
    tasks = tasks_res.json()
    assert len(tasks) > 0
    task_id = tasks[0]["id"]

    # 7. Start and complete a second task without explicit study-session -> auto-logs hours!
    task2_id = tasks[1]["id"] if len(tasks) > 1 else task_id
    auto_res = client.patch(f"/api/tasks/{task2_id}/status", headers=headers, json={
        "status": "COMPLETED"
    })
    assert auto_res.status_code == 200
    assert auto_res.json()["actual_duration_hours"] > 0

    prog_auto = client.get("/api/progress/overview", headers=headers).json()
    assert prog_auto["actual_study_hours"] > 0
    assert prog_auto["current_streak_days"] >= 1

    # Completed tasks are permanently locked and cannot be unchecked/reverted
    if task2_id != task_id:
        revert_res = client.patch(f"/api/tasks/{task2_id}/status", headers=headers, json={
            "status": "NOT_STARTED"
        })
        assert revert_res.status_code == 403

    # 8. Complete first task with explicit duration & log a study session
    status_res = client.patch(f"/api/tasks/{task_id}/status", headers=headers, json={
        "status": "COMPLETED",
        "actual_duration_hours": 2.5,
        "personal_notes": "Completed topic exercises thoroughly."
    })
    assert status_res.status_code == 200
    assert status_res.json()["status"] == "COMPLETED"

    # 9. Log an additional study session
    sess_res = client.post(f"/api/tasks/{task_id}/study-session", headers=headers, json={
        "duration_minutes": 120,
        "notes": "Deep dive session on topic architecture"
    })
    assert sess_res.status_code == 200
    assert sess_res.json()["duration_minutes"] == 120

    # 10. Check progress overview calculation
    prog_res = client.get("/api/progress/overview", headers=headers)
    assert prog_res.status_code == 200
    prog_data = prog_res.json()
    assert prog_data["completed_tasks"] >= 1
    assert prog_data["actual_study_hours"] >= 2.0
    assert prog_data["current_streak_days"] >= 1

def test_student_plan_submission_admin_approval_and_csv_export():
    client.cookies.clear()
    # 1. Student logs in and generates a 3-month plan
    st_login = client.post("/api/auth/login", json={
        "email": "student.demo@aptech.edu",
        "password": "StudentDemo@2026!"
    })
    assert st_login.status_code == 200
    st_headers = {"Authorization": f"Bearer {st_login.json()['access_token']}"}

    enr_res = client.get("/api/enrollments/my", headers=st_headers)
    enrollment_id = enr_res.json()["items"][0]["enrollment_id"]

    target_date = (date.today() + timedelta(days=90)).isoformat()
    gen_res = client.post("/api/plans/generate", headers=st_headers, json={
        "enrollment_id": enrollment_id,
        "target_completion_date": target_date,
        "requested_duration_days": 90,
        "daily_study_hours": 3.0,
        "available_days": ["MON", "TUE", "WED", "THU", "FRI"],
        "preferred_learning_style": "BALANCED",
        "learning_goals": ["Finish in 3 months"],
        "known_topics": [],
        "weak_topics": []
    })
    assert gen_res.status_code == 200
    plan_data = gen_res.json()
    assert plan_data["approval_status"] == "PENDING_APPROVAL"
    assert plan_data["feasibility"] is not None
    plan_id = plan_data["id"]

    # 2. Admin reviews all submitted study plans
    adm_login = client.post("/api/auth/login", json={
        "email": "admin@aptech.edu",
        "password": "AptechAdmin@2026!"
    })
    assert adm_login.status_code == 200
    adm_headers = {"Authorization": f"Bearer {adm_login.json()['access_token']}"}

    list_res = client.get("/api/admin/study-plans?approval_status=PENDING_APPROVAL", headers=adm_headers)
    assert list_res.status_code == 200
    plan_ids = [item["id"] for item in list_res.json()["items"]]
    assert plan_id in plan_ids

    # 3. Admin requests changes
    req_changes = client.patch(f"/api/admin/study-plans/{plan_id}/review", headers=adm_headers, json={
        "approval_status": "CHANGES_REQUESTED",
        "admin_review_note": "Please add Saturday to fit your 3-month target."
    })
    assert req_changes.status_code == 200
    assert req_changes.json()["plan"]["approval_status"] == "CHANGES_REQUESTED"

    # 4. Student adjusts days -> resets to PENDING_APPROVAL
    adj_res = client.patch(f"/api/plans/{plan_id}/adjust", headers=st_headers, json={
        "available_days": ["MON", "TUE", "WED", "THU", "FRI", "SAT"],
        "daily_study_hours": 3.5
    })
    assert adj_res.status_code == 200

    curr_plan = client.get("/api/plans/current", headers=st_headers).json()
    assert curr_plan["approval_status"] == "PENDING_APPROVAL"

    # 5. Admin approves plan
    approve_res = client.patch(f"/api/admin/study-plans/{plan_id}/review", headers=adm_headers, json={
        "approval_status": "APPROVED",
        "admin_review_note": "Looks great! Classes approved."
    })
    assert approve_res.status_code == 200
    assert approve_res.json()["plan"]["approval_status"] == "APPROVED"

    # 6. Export Excel-friendly CSV works for both Student and Admin
    csv_res = client.get(f"/api/plans/{plan_id}/export", headers=st_headers)
    assert csv_res.status_code == 200
    assert "text/csv" in csv_res.headers["content-type"]
    assert "Study Date,Weekday,Order,Task Type" in csv_res.text


def test_approved_plan_edit_requires_admin_approval_and_preserves_old_version():
    client.cookies.clear()
    st_login = client.post("/api/auth/login", json={
        "email": "student.demo@aptech.edu",
        "password": "StudentDemo@2026!"
    })
    assert st_login.status_code == 200
    st_headers = {"Authorization": f"Bearer {st_login.json()['access_token']}"}

    adm_login = client.post("/api/auth/login", json={
        "email": "admin@aptech.edu",
        "password": "AptechAdmin@2026!"
    })
    assert adm_login.status_code == 200
    adm_headers = {"Authorization": f"Bearer {adm_login.json()['access_token']}"}

    # 1. Start from the currently approved plan
    plan = client.get("/api/plans/current", headers=st_headers).json()
    plan_id = plan["id"]
    if plan["approval_status"] != "APPROVED":
        app_res = client.patch(f"/api/admin/study-plans/{plan_id}/review", headers=adm_headers, json={
            "approval_status": "APPROVED",
            "admin_review_note": "Approved for edit workflow test"
        })
        assert app_res.status_code == 200
        plan = client.get("/api/plans/current", headers=st_headers).json()

    old_days = list(plan["available_days"])
    old_hours = plan["daily_study_hours"]
    old_version = plan.get("version_number", 1)

    detail = client.get(f"/api/plans/{plan_id}", headers=st_headers).json()
    tasks = detail["tasks"]
    assert len(tasks) >= 2

    # Ensure the first task is COMPLETED and record its scheduled_date
    first_task = tasks[0]
    if first_task["status"] != "COMPLETED":
        comp_res = client.patch(
            f"/api/tasks/{first_task['id']}/status",
            headers=st_headers,
            json={"status": "COMPLETED", "personal_notes": "Done before edit"}
        )
        assert comp_res.status_code == 200

    detail_before = client.get(f"/api/plans/{plan_id}", headers=st_headers).json()
    completed_before = [t for t in detail_before["tasks"] if t["status"] == "COMPLETED"]
    incomplete_before = [t for t in detail_before["tasks"] if t["status"] != "COMPLETED"]
    expected_rem_hours = round(sum(t["estimated_duration_hours"] for t in incomplete_before), 2)
    completed_dates_before = {t["id"]: t["scheduled_date"] for t in completed_before}

    # 2. Student submits an edit -> MUST NOT overwrite live approved plan yet!
    new_target = (date.today() + timedelta(days=120)).isoformat()
    edit_res = client.patch(f"/api/plans/{plan_id}/adjust", headers=st_headers, json={
        "available_days": ["MON", "WED", "FRI"],
        "daily_study_hours": 2.0,
        "target_completion_date": new_target
    })
    assert edit_res.status_code == 200
    edit_body = edit_res.json()
    assert edit_body["pending_approval"] is True
    assert edit_body["pending_edit_data"]["remaining_tasks_count"] == len(incomplete_before)
    assert abs(edit_body["pending_edit_data"]["remaining_hours"] - expected_rem_hours) < 0.05

    # Student's live active schedule is still untouched until Admin approves
    live_plan = client.get(f"/api/plans/{plan_id}", headers=st_headers).json()
    assert live_plan["has_pending_edit"] is True
    assert live_plan["available_days"] == old_days
    assert live_plan["daily_study_hours"] == old_hours
    assert live_plan.get("version_number", 1) == old_version

    # 3. Admin sees the plan under Pending Approval filter & approves the edit
    pending_list = client.get("/api/admin/study-plans?approval_status=PENDING_APPROVAL", headers=adm_headers).json()
    assert any(item["id"] == plan_id and item["has_pending_edit"] is True for item in pending_list["items"])

    approve_edit = client.patch(f"/api/admin/study-plans/{plan_id}/review-edit", headers=adm_headers, json={
        "decision": "APPROVED",
        "admin_review_note": "Approved Mon/Wed/Fri 2h schedule for remaining topics"
    })
    assert approve_edit.status_code == 200
    updated_plan = approve_edit.json()["plan"]
    assert updated_plan["version_number"] == old_version + 1
    assert updated_plan["has_pending_edit"] is False
    assert updated_plan["available_days"] == ["MON", "WED", "FRI"]
    assert updated_plan["daily_study_hours"] == 2.0

    # 4. Verify completed tasks were NOT touched and remaining tasks fit MON/WED/FRI
    # AND remaining tasks spread evenly across the full 120-day edited window (not clustered in month 1!)
    detail_after = client.get(f"/api/plans/{plan_id}", headers=st_headers).json()
    incomplete_dates_after = []
    for t in detail_after["tasks"]:
        if t["id"] in completed_dates_before:
            assert t["status"] == "COMPLETED"
            assert t["scheduled_date"] == completed_dates_before[t["id"]]
        else:
            dt = date.fromisoformat(t["scheduled_date"])
            assert dt.weekday() in (0, 2, 4)  # MON=0, WED=2, FRI=4
            assert t["estimated_duration_hours"] <= 2.0 + 0.01
            incomplete_dates_after.append(dt)

    # Last scheduled task should reach near the 120-day target (at least 90 days out)
    assert max(incomplete_dates_after) >= date.today() + timedelta(days=90)

    # 5. Verify both Student and Admin can view the old version in /history
    st_hist = client.get(f"/api/plans/{plan_id}/history", headers=st_headers)
    adm_hist = client.get(f"/api/plans/{plan_id}/history", headers=adm_headers)
    assert st_hist.status_code == 200
    assert adm_hist.status_code == 200
    versions = st_hist.json()
    assert len(versions) >= 1
    saved_old = next((v for v in versions if v["source_type"] == "VERSION_SNAPSHOT" and v["version_number"] == old_version), None)
    assert saved_old is not None
    assert saved_old["daily_study_hours"] == old_hours
    assert saved_old["available_days"] == old_days
    assert len(saved_old["snapshot_tasks"]) >= len(tasks)

    # 6. Admin/Teacher marks another task complete -> 2-way reflection & permanent lock
    target_task = next(t for t in detail_after["tasks"] if t["status"] != "COMPLETED")
    adm_comp = client.patch(
        f"/api/admin/study-plans/{plan_id}/tasks/{target_task['id']}/complete",
        headers=adm_headers,
    )
    assert adm_comp.status_code == 200
    assert adm_comp.json()["task"]["status"] == "COMPLETED"

    # Student immediately sees it COMPLETED and cannot uncheck it (403)
    st_detail = client.get(f"/api/plans/{plan_id}", headers=st_headers).json()
    matched = next(t for t in st_detail["tasks"] if t["id"] == target_task["id"])
    assert matched["status"] == "COMPLETED"
    revert_res = client.patch(
        f"/api/tasks/{target_task['id']}/status",
        headers=st_headers,
        json={"status": "NOT_STARTED"},
    )
    assert revert_res.status_code == 403


