import io
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def get_admin_token():
    res = client.post("/auth/login", json={"email": "admin@aptech.edu", "password": "AdminMaster@2026!"})
    if res.status_code != 200:
        res = client.post("/auth/login", json={"email": "admin@aptech.edu", "password": "AptechAdmin@2026!"})
    assert res.status_code == 200
    return res.json()["access_token"]


def get_student_token():
    res = client.post("/auth/login", json={"email": "student.demo@aptech.edu", "password": "StudentDemo@2026!"})
    assert res.status_code == 200
    return res.json()["access_token"]


def test_chat_flow_and_file_validation():
    admin_token = get_admin_token()
    student_token = get_student_token()
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    student_headers = {"Authorization": f"Bearer {student_token}"}

    # 1. Student fetches available admins to chat with
    admins_res = client.get("/api/chat/admins", headers=student_headers)
    assert admins_res.status_code == 200
    admin_list = admins_res.json()
    assert len(admin_list) > 0
    target_admin_id = admin_list[0]["admin"]["id"]

    # 2. Student starts or gets conversation with admin
    start_res = client.post(
        "/api/chat/conversations/start",
        headers=student_headers,
        json={"admin_id": target_admin_id}
    )
    assert start_res.status_code == 200
    conv_id = start_res.json()["conversation_id"]
    assert conv_id is not None

    # 3. Student sends a message: "Sir, aaj class late join karunga"
    msg_res = client.post(
        f"/api/chat/conversations/{conv_id}/messages",
        headers=student_headers,
        data={"message_text": "Sir, aaj 15 min late join karunga. Please start accordingly."}
    )
    assert msg_res.status_code == 200
    sent_msg = msg_res.json()
    assert sent_msg["message_text"] == "Sir, aaj 15 min late join karunga. Please start accordingly."
    assert sent_msg["sender_role"] == "STUDENT"

    # 4. Student sends an allowed attachment: a sample PDF
    sample_pdf_bytes = b"%PDF-1.4 sample pdf content for testing research paper proposal"
    file_pdf = ("research_draft.pdf", io.BytesIO(sample_pdf_bytes), "application/pdf")
    pdf_res = client.post(
        f"/api/chat/conversations/{conv_id}/messages",
        headers=student_headers,
        data={"message_text": "Here is my research draft proposal."},
        files={"file": file_pdf}
    )
    assert pdf_res.status_code == 200
    pdf_msg = pdf_res.json()
    assert pdf_msg["attachment_name"] == "research_draft.pdf"
    assert pdf_msg["attachment_type"] == "PDF"

    # 5. Student tries to upload a VIDEO (.mp4) -> MUST BE STRICTLY REJECTED!
    sample_video_bytes = b"fake video bytes"
    file_video = ("my_project_demo.mp4", io.BytesIO(sample_video_bytes), "video/mp4")
    video_res = client.post(
        f"/api/chat/conversations/{conv_id}/messages",
        headers=student_headers,
        data={"message_text": "Check this video."},
        files={"file": file_video}
    )
    assert video_res.status_code == 400
    assert "video" in video_res.json()["detail"].lower()

    # 6. Admin checks student messages list
    admin_students_res = client.get("/api/chat/students", headers=admin_headers)
    assert admin_students_res.status_code == 200
    students_inbox = admin_students_res.json()
    assert any(s["conversation_id"] == conv_id for s in students_inbox)

    # 7. Admin reads messages in the conversation
    messages_res = client.get(f"/api/chat/conversations/{conv_id}/messages", headers=admin_headers)
    assert messages_res.status_code == 200
    msgs = messages_res.json()
    assert len(msgs) >= 2

    # 8. Admin replies to student: "Noted. Share your progress sheet."
    reply_res = client.post(
        f"/api/chat/conversations/{conv_id}/messages",
        headers=admin_headers,
        data={"message_text": "Noted. We will start 15 minutes late. Make sure to review the ethics guidelines."}
    )
    assert reply_res.status_code == 200
    admin_reply = reply_res.json()
    assert admin_reply["sender_role"] == "ADMIN"
