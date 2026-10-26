from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from omr.layout import MAX_QUESTIONS


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---- Người dùng -----------------------------------------------------------------

class LoginIn(BaseModel):
    username: str
    password: str


class UserOut(ORM):
    id: int
    username: str
    full_name: str
    role: str
    created_at: datetime | None = None


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    full_name: str = ""
    password: str = Field(min_length=6)
    role: str = Field(default="teacher", pattern="^(admin|teacher)$")


class PasswordChange(BaseModel):
    old_password: str
    new_password: str = Field(min_length=6)


# ---- Kỳ thi ---------------------------------------------------------------------

class ExamBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    subject: str = ""
    exam_date: str = ""
    description: str = ""
    num_questions: int = Field(ge=1, le=MAX_QUESTIONS)
    num_options: int = Field(default=4, ge=2, le=6)
    max_score: float = Field(default=10.0, gt=0)
    pass_score: float = Field(default=5.0, ge=0)


class ExamCreate(ExamBase):
    pass


class ExamUpdate(BaseModel):
    name: str | None = None
    subject: str | None = None
    exam_date: str | None = None
    description: str | None = None
    num_questions: int | None = Field(default=None, ge=1, le=MAX_QUESTIONS)
    num_options: int | None = Field(default=None, ge=2, le=6)
    max_score: float | None = Field(default=None, gt=0)
    pass_score: float | None = Field(default=None, ge=0)


class ExamOut(ORM, ExamBase):
    id: int
    owner_id: int | None
    created_at: datetime | None = None


class ExamSummary(ExamOut):
    num_keys: int = 0
    num_students: int = 0
    num_submissions: int = 0
    num_review: int = 0
    avg_score: float | None = None
    owner_name: str = ""


# ---- Đáp án ---------------------------------------------------------------------

def _norm_answers(v):
    if isinstance(v, str):
        v = [c for c in v.upper() if c.isalpha() or c in "-_ "]
        v = ["" if c in "-_ " else c for c in v]
    return [str(a).strip().upper() for a in v]


class KeyIn(BaseModel):
    code: str = Field(pattern=r"^\d{1,3}$")
    answers: list[str] | str

    @field_validator("answers", mode="before")
    @classmethod
    def _answers(cls, v):
        return _norm_answers(v)

    @field_validator("code")
    @classmethod
    def _code(cls, v: str) -> str:
        return v.zfill(3)


class KeyOut(ORM):
    id: int
    exam_id: int
    code: str
    answers: list[str]


# ---- Thí sinh -------------------------------------------------------------------

class StudentIn(BaseModel):
    sbd: str = Field(pattern=r"^\d{1,6}$")
    full_name: str = Field(min_length=1)
    dob: str = ""
    class_name: str = ""
    room: str = ""

    @field_validator("sbd")
    @classmethod
    def _sbd(cls, v: str) -> str:
        return v.zfill(6)


class StudentOut(ORM):
    id: int
    exam_id: int
    sbd: str
    full_name: str
    dob: str
    class_name: str
    room: str


class StudentWithResult(StudentOut):
    submission_id: int | None = None
    score: float | None = None
    status: str | None = None


# ---- Bài làm --------------------------------------------------------------------

class SubmissionBrief(ORM):
    id: int
    exam_id: int
    student_id: int | None
    status: str
    source_name: str
    sbd: str
    exam_code: str
    num_correct: int | None
    score: float | None
    confidence: float
    error: str
    flags: list
    reviewed: bool
    created_at: datetime | None = None
    updated_at: datetime | None = None
    student_name: str = ""
    class_name: str = ""


class SubmissionOut(SubmissionBrief):
    answers: list[str]
    omr_sbd: str
    omr_exam_code: str
    omr_answers: list[str]
    omr_detail: dict
    align_method: str
    rotation: int
    elapsed_ms: float
    key: list[str] | None = None
    has_images: dict = {}


class SubmissionPatch(BaseModel):
    sbd: str | None = Field(default=None, pattern=r"^[\d?*]{0,6}$")
    exam_code: str | None = Field(default=None, pattern=r"^[\d?*]{0,3}$")
    answers: list[str] | None = None
    reviewed: bool | None = None

    @field_validator("answers", mode="before")
    @classmethod
    def _answers(cls, v):
        return None if v is None else [str(a).strip().upper() for a in v]
