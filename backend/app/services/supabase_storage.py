import os
import logging
import httpx
from typing import Optional
from app.core.config import settings

logger = logging.getLogger("aptech_planner.services.storage")

BUCKET_NAME = "profile-documents"


def _get_auth_headers(content_type: str = "application/octet-stream") -> Optional[dict]:
    key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY
    if not key or not settings.SUPABASE_URL:
        return None
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": content_type,
        "x-upsert": "true"
    }


def upload_file_to_supabase(path: str, data: bytes, content_type: str = "application/octet-stream") -> bool:
    """Uploads file bytes to Supabase Storage bucket."""
    headers = _get_auth_headers(content_type)
    if not headers or not settings.SUPABASE_URL:
        return False
    url = f"{settings.SUPABASE_URL}/storage/v1/object/{BUCKET_NAME}/{path.lstrip('/')}"
    try:
        with httpx.Client(timeout=30.0) as client:
            resp = client.post(url, headers=headers, content=data)
            if resp.status_code in {200, 201}:
                logger.info(f"Uploaded {path} to Supabase storage.")
                return True
            logger.warning(f"Supabase upload notice for {path}: {resp.status_code} {resp.text}")
            return False
    except Exception as e:
        logger.error(f"Failed to upload to Supabase storage ({path}): {e}")
        return False


def download_file_from_supabase(path: str) -> Optional[bytes]:
    """Downloads file bytes from Supabase Storage bucket."""
    if not settings.SUPABASE_URL:
        return None
    key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY
    public_url = f"{settings.SUPABASE_URL}/storage/v1/object/public/{BUCKET_NAME}/{path.lstrip('/')}"
    try:
        with httpx.Client(timeout=30.0) as client:
            resp = client.get(public_url)
            if resp.status_code == 200:
                return resp.content
    except Exception:
        pass

    if key:
        auth_url = f"{settings.SUPABASE_URL}/storage/v1/object/{BUCKET_NAME}/{path.lstrip('/')}"
        headers = {"apikey": key, "Authorization": f"Bearer {key}"}
        try:
            with httpx.Client(timeout=30.0) as client:
                resp = client.get(auth_url, headers=headers)
                if resp.status_code == 200:
                    return resp.content
        except Exception as e:
            logger.error(f"Failed to download from Supabase storage ({path}): {e}")
    return None
