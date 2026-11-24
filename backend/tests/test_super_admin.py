import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.user import User, UserRole

client = TestClient(app)

def test_ankit_is_super_admin():
    db = SessionLocal()
    ankit = db.query(User).filter(User.email == "ankitk629990@gmail.com").first()
    assert ankit is not None
    assert ankit.role == UserRole.SUPER_ADMIN.value
    db.close()

def test_super_admin_login_and_role():
    res = client.post("/api/auth/login", json={
        "email": "ankitk629990@gmail.com",
        "password": "12345678"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["role"] == "SUPER_ADMIN"
    assert data["email"] == "ankitk629990@gmail.com"

def test_admin_management_crud_and_protections():
    # 1. Login as Super Admin Ankit
    sa_res = client.post("/api/auth/login", json={
        "email": "ankitk629990@gmail.com",
        "password": "12345678"
    })
    assert sa_res.status_code == 200
    sa_data = sa_res.json()
    sa_token = sa_data["access_token"]
    sa_id = sa_data["user_id"]
    sa_headers = {"Authorization": f"Bearer {sa_token}"}

    # 2. Super admin lists admins
    list_res = client.get("/api/admin/admins", headers=sa_headers)
    assert list_res.status_code == 200
    admins = list_res.json()
    assert any(a["email"] == "ankitk629990@gmail.com" and a["role"] == "SUPER_ADMIN" for a in admins)

    # 3. Create a new admin
    new_admin_email = "testfaculty@aptech.edu"
    create_res = client.post("/api/admin/admins", headers=sa_headers, json={
        "full_name": "Test Faculty",
        "email": new_admin_email,
        "password": "FacultyPassword@123"
    })
    assert create_res.status_code == 201
    created_admin = create_res.json()
    created_id = created_admin["id"]
    assert created_admin["role"] == "ADMIN"
    assert created_admin["email"] == new_admin_email

    # 4. Super Admin can toggle status of the new admin
    status_res = client.patch(f"/api/admin/admins/{created_id}/status", headers=sa_headers, json={
        "is_suspended": True,
        "is_active": False
    })
    assert status_res.status_code == 200
    assert status_res.json()["is_suspended"] is True

    # 5. Protected: Cannot suspend Super Admin Ankit
    suspend_sa_res = client.patch(f"/api/admin/admins/{sa_id}/status", headers=sa_headers, json={
        "is_suspended": True
    })
    assert suspend_sa_res.status_code == 400

    # 6. Protected: Cannot delete Super Admin Ankit
    del_sa_res = client.delete(f"/api/admin/admins/{sa_id}", headers=sa_headers)
    assert del_sa_res.status_code in (400, 403)

    # 7. Non-super admin cannot delete admins
    # Login as created admin
    reactivate_res = client.patch(f"/api/admin/admins/{created_id}/status", headers=sa_headers, json={
        "is_suspended": False,
        "is_active": True
    })
    assert reactivate_res.status_code == 200

    faculty_res = client.post("/api/auth/login", json={
        "email": new_admin_email,
        "password": "FacultyPassword@123"
    })
    assert faculty_res.status_code == 200
    faculty_token = faculty_res.json()["access_token"]
    faculty_headers = {"Authorization": f"Bearer {faculty_token}"}

    # Non-super admin tries admin management actions (all must return 403)
    fac_list_res = client.get("/api/admin/admins", headers=faculty_headers)
    assert fac_list_res.status_code == 403

    fac_create_res = client.post("/api/admin/admins", headers=faculty_headers, json={
        "full_name": "Rogue Admin",
        "email": "rogue@aptech.edu",
        "password": "Password123"
    })
    assert fac_create_res.status_code == 403

    fac_status_res = client.patch(f"/api/admin/admins/{created_id}/status", headers=faculty_headers, json={
        "is_suspended": True
    })
    assert fac_status_res.status_code == 403

    # Faculty tries to delete Ankit
    fac_del_res = client.delete(f"/api/admin/admins/{sa_id}", headers=faculty_headers)
    assert fac_del_res.status_code == 403

    # 8. Super Admin deletes the test faculty admin successfully
    del_fac_res = client.delete(f"/api/admin/admins/{created_id}", headers=sa_headers)
    assert del_fac_res.status_code == 200
    assert del_fac_res.json()["success"] is True
