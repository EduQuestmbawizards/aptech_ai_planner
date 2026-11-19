import os
from pathlib import Path
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent
ROOT_DIR = BASE_DIR.parent
DEFAULT_DB_FILE = (ROOT_DIR / "aptech_planner.db").resolve().as_posix()

class Settings(BaseSettings):
    PROJECT_NAME: str = "Aptech AI Career & Study Planner"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"

    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        os.getenv("SUPABASE_DB_URL", f"sqlite:///{DEFAULT_DB_FILE}")
    )
    # Supabase
    SUPABASE_URL: Optional[str] = os.getenv("SUPABASE_URL", os.getenv("NEXT_PUBLIC_SUPABASE_URL"))
    SUPABASE_ANON_KEY: Optional[str] = os.getenv("SUPABASE_ANON_KEY", os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY"))
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    SUPABASE_DB_URL: Optional[str] = os.getenv("SUPABASE_DB_URL")

    # Security
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "aptech-super-secret-jwt-key-change-in-production-32chars")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 120
    INVITATION_TOKEN_EXPIRE_HOURS: int = 72

    # OpenAI
    OPENAI_API_KEY: Optional[str] = os.getenv("OPENAI_API_KEY")
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    # Email / SMTP
    EMAIL_HOST: str = os.getenv("EMAIL_HOST", os.getenv("SMTP_HOST", "smtp.gmail.com"))
    EMAIL_PORT: int = int(os.getenv("EMAIL_PORT", os.getenv("SMTP_PORT", 465)))
    EMAIL_USERNAME: Optional[str] = os.getenv("EMAIL_USERNAME", os.getenv("SMTP_USER", "rupali.eduquest@gmail.com"))
    EMAIL_PASSWORD: Optional[str] = os.getenv("EMAIL_PASSWORD", os.getenv("SMTP_PASS", os.getenv("SMTP_PASSWORD", "vrqesekhucbadqwk")))
    EMAIL_FROM: str = os.getenv("EMAIL_FROM", os.getenv("SMTP_FROM", "EduQuest Leads <rupali.eduquest@gmail.com>"))
    EMAIL_ENABLED: bool = os.getenv("EMAIL_ENABLED", "true").lower() == "true"
    ADMIN_EMAIL: str = os.getenv("ADMIN_EMAIL", "rupali.eduquest@gmail.com")

    # URLs
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "https://ai-planner.eduquest.org.in")
    BACKEND_URL: str = os.getenv("BACKEND_URL", "https://aptech-ai-planner.onrender.com" if (os.getenv("RENDER") or os.getenv("PORT")) else "http://localhost:8000")

    # EduQuest Integration
    EDUQUEST_INTEGRATION_SECRET: str = os.getenv("EDUQUEST_INTEGRATION_SECRET", "eduquest-shared-secret-key-32chars")

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ]

    @property
    def cors_origins(self) -> List[str]:
        origins = list(self.BACKEND_CORS_ORIGINS)
        if self.FRONTEND_URL and self.FRONTEND_URL.strip():
            f_url = self.FRONTEND_URL.strip().rstrip("/")
            if f_url not in origins:
                origins.append(f_url)
        custom_origins = os.getenv("CORS_ORIGINS", "")
        if custom_origins:
            for o in custom_origins.split(","):
                o_clean = o.strip().rstrip("/")
                if o_clean and o_clean not in origins:
                    origins.append(o_clean)
        return origins

    model_config = SettingsConfigDict(
        env_file=[str(ROOT_DIR / ".env"), str(BASE_DIR / ".env"), ".env"],
        extra="ignore"
    )

settings = Settings()
