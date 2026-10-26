from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(128), default="")
    password_hash: Mapped[str] = mapped_column(String(256))
    role: Mapped[str] = mapped_column(String(16), default="teacher")  # admin | teacher
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Exam(Base):
    __tablename__ = "exams"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    subject: Mapped[str] = mapped_column(String(120), default="")
    exam_date: Mapped[str] = mapped_column(String(32), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    num_questions: Mapped[int] = mapped_column(Integer)
    num_options: Mapped[int] = mapped_column(Integer, default=4)
    max_score: Mapped[float] = mapped_column(Float, default=10.0)
    pass_score: Mapped[float] = mapped_column(Float, default=5.0)
    owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    keys: Mapped[list[AnswerKey]] = relationship(back_populates="exam", cascade="all, delete-orphan", order_by="AnswerKey.code")
    students: Mapped[list[Student]] = relationship(back_populates="exam", cascade="all, delete-orphan")
    submissions: Mapped[list[Submission]] = relationship(back_populates="exam", cascade="all, delete-orphan")
    owner: Mapped[User | None] = relationship()


class AnswerKey(Base):
    """Đáp án của một mã đề."""

    __tablename__ = "answer_keys"
    __table_args__ = (UniqueConstraint("exam_id", "code"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    exam_id: Mapped[int] = mapped_column(ForeignKey("exams.id", ondelete="CASCADE"), index=True)
    code: Mapped[str] = mapped_column(String(8))
    answers: Mapped[list] = mapped_column(JSON, default=list)  # ["A", "C", ...]
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    exam: Mapped[Exam] = relationship(back_populates="keys")


class Student(Base):
    __tablename__ = "students"
    __table_args__ = (UniqueConstraint("exam_id", "sbd"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    exam_id: Mapped[int] = mapped_column(ForeignKey("exams.id", ondelete="CASCADE"), index=True)
    sbd: Mapped[str] = mapped_column(String(16))
    full_name: Mapped[str] = mapped_column(String(128))
    dob: Mapped[str] = mapped_column(String(32), default="")
    class_name: Mapped[str] = mapped_column(String(64), default="")
    room: Mapped[str] = mapped_column(String(32), default="")

    exam: Mapped[Exam] = relationship(back_populates="students")


class Submission(Base):
    """Một bài làm (một tờ phiếu đã quét)."""

    __tablename__ = "submissions"

    id: Mapped[int] = mapped_column(primary_key=True)
    exam_id: Mapped[int] = mapped_column(ForeignKey("exams.id", ondelete="CASCADE"), index=True)
    student_id: Mapped[int | None] = mapped_column(ForeignKey("students.id", ondelete="SET NULL"), index=True)
    status: Mapped[str] = mapped_column(String(16), default="graded", index=True)  # graded | review | error
    source_name: Mapped[str] = mapped_column(String(255), default="")

    sbd: Mapped[str] = mapped_column(String(16), default="")
    exam_code: Mapped[str] = mapped_column(String(8), default="")
    answers: Mapped[list] = mapped_column(JSON, default=list)       # đáp án cuối cùng (có thể đã sửa tay)
    omr_sbd: Mapped[str] = mapped_column(String(16), default="")
    omr_exam_code: Mapped[str] = mapped_column(String(8), default="")
    omr_answers: Mapped[list] = mapped_column(JSON, default=list)   # kết quả máy đọc ban đầu
    flags: Mapped[list] = mapped_column(JSON, default=list)
    omr_detail: Mapped[dict] = mapped_column(JSON, default=dict)    # vị trí/giá trị từng ô, ngưỡng...

    num_correct: Mapped[int | None] = mapped_column(Integer)
    score: Mapped[float | None] = mapped_column(Float)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    error: Mapped[str] = mapped_column(Text, default="")
    align_method: Mapped[str] = mapped_column(String(32), default="")
    rotation: Mapped[int] = mapped_column(Integer, default=0)
    elapsed_ms: Mapped[float] = mapped_column(Float, default=0.0)

    image_original: Mapped[str] = mapped_column(String(255), default="")
    image_warped: Mapped[str] = mapped_column(String(255), default="")
    image_annotated: Mapped[str] = mapped_column(String(255), default="")

    reviewed: Mapped[bool] = mapped_column(Boolean, default=False)
    reviewed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    exam: Mapped[Exam] = relationship(back_populates="submissions")
    student: Mapped[Student | None] = relationship()


class AuditLog(Base):
    """Lịch sử chỉnh sửa (phục vụ phúc tra)."""

    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    exam_id: Mapped[int | None] = mapped_column(ForeignKey("exams.id", ondelete="CASCADE"), index=True)
    submission_id: Mapped[int | None] = mapped_column(ForeignKey("submissions.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    action: Mapped[str] = mapped_column(String(64))
    detail: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    user: Mapped[User | None] = relationship()
