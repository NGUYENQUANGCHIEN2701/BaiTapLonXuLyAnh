from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select

from .config import DEFAULT_ADMIN_PASSWORD, DEFAULT_ADMIN_USER, FRONTEND_DIST
from .db import Base, SessionLocal, engine
from .models import User
from .routers import auth, chat, dashboard, exams, lab, submissions
from .security import hash_password
from .services.chat import ChatService


def init_db() -> None:
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        if db.scalar(select(User).limit(1)) is None:
            db.add(User(username=DEFAULT_ADMIN_USER, full_name="Quản trị viên", role="admin",
                        password_hash=hash_password(DEFAULT_ADMIN_PASSWORD)))
            db.commit()


@asynccontextmanager
async def lifespan(application: FastAPI):
    init_db()
    application.state.chat_service = ChatService()
    try:
        yield
    finally:
        await application.state.chat_service.close()


app = FastAPI(title="Hệ thống quản lý kỳ thi & chấm trắc nghiệm", version="1.0.0", lifespan=lifespan)
app.add_middleware(  # cho phép Vite dev server (cổng 5173) gọi API khi phát triển
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (auth.router, exams.router, submissions.router, lab.router, dashboard.router, chat.router):
    app.include_router(r)


@app.get("/api/health")
def health():
    return {"ok": True}


# ---- Phục vụ giao diện đã build (SPA) ------------------------------------------

if (FRONTEND_DIST / "assets").exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")


@app.get("/{path:path}", include_in_schema=False)
def spa(path: str, request: Request):
    if path.startswith("api/"):
        raise HTTPException(404)
    f = (FRONTEND_DIST / path).resolve()
    if path and f.is_file() and FRONTEND_DIST.resolve() in f.parents:
        return FileResponse(f)
    index = FRONTEND_DIST / "index.html"
    if index.exists():
        return FileResponse(index)
    return JSONResponse({"message": "Chưa build giao diện. Chạy: cd frontend && npm install && npm run build"}, 404)
