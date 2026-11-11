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

# Chatbot: chỉ backend biết URL và khóa truy cập dịch vụ AI.
CHAT_COMPLETIONS_URL = os.environ.get("OMR_CHAT_COMPLETIONS_URL", "https://sly-series-landowner.ngrok-free.dev/v1/chat/completions")
CHAT_HEALTH_URL = os.environ.get("OMR_CHAT_HEALTH_URL", "https://sly-series-landowner.ngrok-free.dev/health")
# Model ToanPhamAIEngi/Qwen3-8B-Vietnam-MultiDomainEdu do QtedEdu cấu hình trên Kaggle.
CHAT_API_KEY = os.environ.get("OMR_CHAT_API_KEY", "")
CHAT_TIMEOUT = float(os.environ.get("OMR_CHAT_TIMEOUT", "90"))
CHAT_HEALTH_TIMEOUT = float(os.environ.get("OMR_CHAT_HEALTH_TIMEOUT", "5"))
CHAT_MAX_TOKENS = int(os.environ.get("OMR_CHAT_MAX_TOKENS", "2048"))
CHAT_MAX_CONCURRENT = int(os.environ.get("OMR_CHAT_MAX_CONCURRENT", "2"))
if min(CHAT_TIMEOUT, CHAT_HEALTH_TIMEOUT, CHAT_MAX_TOKENS, CHAT_MAX_CONCURRENT) <= 0:
    raise ValueError("Cấu hình timeout, token và số yêu cầu chatbot phải lớn hơn 0")
