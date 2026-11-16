import sys
import os
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.append(str(backend_dir))

from app.core.database import SessionLocal
from app.core.security import get_password_hash
from app.models.user import User, UserRole

def create_admin(email: str, password: str, full_name: str = "Administrator"):
    if len(password) < 8:
        print("Error: Password must be at least 8 characters long.")
        return False

    db = SessionLocal()
    try:
        clean_email = email.lower().strip()
        existing = db.query(User).filter(User.email == clean_email).first()
        if existing:
            if existing.role == UserRole.ADMIN.value:
                print(f"Admin with email '{clean_email}' already exists. Updating password...")
                existing.password_hash = get_password_hash(password)
                existing.is_active = True
                existing.is_suspended = False
                db.commit()
                print(f"Password updated for admin '{clean_email}'!")
                return True
            else:
                print(f"User exists as '{existing.role}'. Promoting to ADMIN and updating password...")
                existing.role = UserRole.ADMIN.value
                existing.password_hash = get_password_hash(password)
                existing.is_active = True
                existing.is_suspended = False
                db.commit()
                print(f"User promoted to ADMIN successfully!")
                return True

        admin = User(
            email=clean_email,
            full_name=full_name.strip(),
            role=UserRole.ADMIN.value,
            password_hash=get_password_hash(password),
            is_active=True,
            is_suspended=False
        )
        db.add(admin)
        db.commit()
        print(f"Admin account created successfully!")
        print(f"  Email: {admin.email}")
        print(f"  Name:  {admin.full_name}")
        print(f"  Role:  ADMIN")
        return True
    finally:
        db.close()

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python create_admin.py <email> <password> [full_name]")
        print("Example: python create_admin.py newadmin@aptech.edu SecretPass@2026! \"Super Admin\"")
    else:
        email = sys.argv[1]
        password = sys.argv[2]
        name = sys.argv[3] if len(sys.argv) > 3 else "Administrator"
        create_admin(email, password, name)

