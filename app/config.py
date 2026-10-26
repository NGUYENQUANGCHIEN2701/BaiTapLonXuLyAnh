from __future__ import annotations

import os
import secrets
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = Path(os.environ.get("OMR_DATA_DIR", BASE_DIR / "data"))
UPLOAD_DIR = DATA_DIR / "uploads"
FRONTEND_DIST = BASE_DIR / "frontend" / "dist"
DATABASE_URL = os.environ.get("OMR_DATABASE_URL", f"sqlite:///{(DATA_DIR / 'app.db').as_posix()}")

DATA_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def _secret_key() -> str:
    env = os.environ.get("OMR_SECRET_KEY")
    if env:
        return env
    f = DATA_DIR / "secret.key"
    if not f.exists():
        f.write_text(secrets.token_urlsafe(48), encoding="utf-8")
    return f.read_text(encoding="utf-8").strip()


SECRET_KEY = _secret_key()
SESSION_COOKIE = "omr_session"
SESSION_DAYS = 7

DEFAULT_ADMIN_USER = os.environ.get("OMR_ADMIN_USER", "admin")
DEFAULT_ADMIN_PASSWORD = os.environ.get("OMR_ADMIN_PASSWORD", "admin123")

# Lưu ảnh gốc ở kích thước tối đa này (tiết kiệm dung lượng)
STORE_MAX_SIDE = 2000
