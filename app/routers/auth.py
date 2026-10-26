from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import SESSION_COOKIE, SESSION_DAYS
from ..db import get_db
from ..models import User
from ..schemas import LoginIn, PasswordChange, UserCreate, UserOut
from ..security import current_user, hash_password, make_token, require_admin, verify_password

router = APIRouter(prefix="/api", tags=["auth"])


@router.post("/auth/login", response_model=UserOut)
def login(body: LoginIn, response: Response, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.username == body.username.strip()))
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Sai tên đăng nhập hoặc mật khẩu")
    response.set_cookie(SESSION_COOKIE, make_token(user.id), max_age=SESSION_DAYS * 86400, httponly=True, samesite="lax")
    return user


@router.post("/auth/logout")
def logout(response: Response):
    response.delete_cookie(SESSION_COOKIE)
    return {"ok": True}


@router.get("/auth/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return user


@router.post("/auth/password")
def change_password(body: PasswordChange, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if not verify_password(body.old_password, user.password_hash):
        raise HTTPException(400, "Mật khẩu hiện tại không đúng")
    user.password_hash = hash_password(body.new_password)
    db.commit()
    return {"ok": True}


@router.get("/users", response_model=list[UserOut])
def list_users(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    return db.scalars(select(User).order_by(User.id)).all()


@router.post("/users", response_model=UserOut)
def create_user(body: UserCreate, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    if db.scalar(select(User).where(User.username == body.username)):
        raise HTTPException(400, "Tên đăng nhập đã tồn tại")
    u = User(username=body.username, full_name=body.full_name, role=body.role, password_hash=hash_password(body.password))
    db.add(u)
    db.commit()
    return u


@router.delete("/users/{user_id}")
def delete_user(user_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    if user_id == admin.id:
        raise HTTPException(400, "Không thể tự xóa tài khoản của mình")
    u = db.get(User, user_id)
    if u is None:
        raise HTTPException(404, "Không tìm thấy người dùng")
    db.delete(u)
    db.commit()
    return {"ok": True}
