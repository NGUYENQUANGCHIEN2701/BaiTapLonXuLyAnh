from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from omr.pipeline import load_image_bytes

from ..db import get_db
from ..models import AuditLog, Exam, Submission, User
from ..schemas import SubmissionBrief, SubmissionOut, SubmissionPatch
from ..security import current_user, get_exam_for
from ..services.grading import evaluate, grade_image, image_path, key_for

router = APIRouter(prefix="/api", tags=["submissions"])

MAX_UPLOAD = 40 * 1024 * 1024


def _brief(s: Submission) -> SubmissionBrief:
    b = SubmissionBrief.model_validate(s)
    if s.student:
        b.student_name, b.class_name = s.student.full_name, s.student.class_name
    return b


def _full(db: Session, s: Submission) -> SubmissionOut:
    out = SubmissionOut.model_validate(s)
    if s.student:
        out.student_name, out.class_name = s.student.full_name, s.student.class_name
    key = key_for(db, s.exam, s.exam_code) if s.exam_code else None
    out.key = key.answers[: s.exam.num_questions] if key else None
    out.has_images = {k: bool(getattr(s, f"image_{k}")) for k in ("original", "warped", "annotated")}
    return out


def _get_sub(db: Session, user: User, sub_id: int) -> Submission:
    s = db.get(Submission, sub_id)
    if s is None:
        raise HTTPException(404, "Không tìm thấy bài làm")
    get_exam_for(user, s.exam_id, db)
    return s


@router.post("/exams/{exam_id}/submissions", response_model=list[SubmissionBrief])
async def upload(exam_id: int, files: list[UploadFile] = File(...), user: User = Depends(current_user),
                 db: Session = Depends(get_db)):
    exam = get_exam_for(user, exam_id, db)
    out = []
    for f in files:
        data = await f.read()
        if len(data) > MAX_UPLOAD:
            raise HTTPException(413, f"{f.filename}: file quá lớn (tối đa 40MB)")
        try:
            images = load_image_bytes(data)
        except ValueError:
            raise HTTPException(400, f"{f.filename}: không phải file ảnh hoặc PDF hợp lệ")
        for i, img in enumerate(images):
            name = f.filename or "upload"
            if len(images) > 1:
                name = f"{name}#trang{i + 1}"
            sub = grade_image(db, exam, img, name, user.id)
            db.commit()
            out.append(_brief(sub))
    return out


@router.get("/exams/{exam_id}/submissions", response_model=list[SubmissionBrief])
def list_submissions(exam_id: int, status: str | None = Query(None, pattern="^(graded|review|error)$"),
                     q: str | None = None, user: User = Depends(current_user), db: Session = Depends(get_db)):
    exam = get_exam_for(user, exam_id, db)
    stmt = select(Submission).where(Submission.exam_id == exam.id).order_by(Submission.id.desc())
    if status:
        stmt = stmt.where(Submission.status == status)
    subs = [_brief(s) for s in db.scalars(stmt)]
    if q:
        ql = q.lower()
        subs = [s for s in subs if ql in s.sbd or ql in s.student_name.lower() or ql in s.source_name.lower()]
    return subs


@router.get("/submissions/{sub_id}", response_model=SubmissionOut)
def get_submission(sub_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return _full(db, _get_sub(db, user, sub_id))


@router.get("/submissions/{sub_id}/neighbors")
def neighbors(sub_id: int, status: str | None = None, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Bài trước / sau trong cùng kỳ thi (dùng cho chế độ duyệt nhanh)."""
    s = _get_sub(db, user, sub_id)
    base = select(Submission.id).where(Submission.exam_id == s.exam_id)
    if status:
        base = base.where(Submission.status == status)
    prev_id = db.scalar(base.where(Submission.id > s.id).order_by(Submission.id.asc()).limit(1))
    next_id = db.scalar(base.where(Submission.id < s.id).order_by(Submission.id.desc()).limit(1))
    remaining = len(db.scalars(select(Submission.id).where(Submission.exam_id == s.exam_id, Submission.status == "review")).all())
    return {"prev": prev_id, "next": next_id, "review_remaining": remaining}


@router.patch("/submissions/{sub_id}", response_model=SubmissionOut)
def patch_submission(sub_id: int, body: SubmissionPatch, user: User = Depends(current_user), db: Session = Depends(get_db)):
    s = _get_sub(db, user, sub_id)
    exam: Exam = s.exam
    changes = {}
    detail = dict(s.omr_detail or {})
    resolved = set(detail.get("resolved", []))
    if body.sbd is not None and body.sbd != s.sbd:
        changes["sbd"] = [s.sbd, body.sbd]
        s.sbd = body.sbd
        resolved.add("sbd")
    if body.exam_code is not None and body.exam_code != s.exam_code:
        changes["exam_code"] = [s.exam_code, body.exam_code]
        s.exam_code = body.exam_code
        resolved.add("code")
    if body.answers is not None:
        valid = set("ABCDEF"[: exam.num_options])
        new = (body.answers + [""] * exam.num_questions)[: exam.num_questions]
        for i, a in enumerate(new, 1):
            if any(c not in valid for c in a):
                raise HTTPException(400, f"Câu {i}: '{a}' không hợp lệ")
        diff = {str(i + 1): [o, n] for i, (o, n) in enumerate(zip(s.answers, new)) if o != n}
        if diff:
            changes["answers"] = diff
            resolved.update(f"q{q}" for q in diff)
        s.answers = new
    if body.reviewed is not None:
        if body.reviewed != s.reviewed:
            changes["reviewed"] = body.reviewed
        s.reviewed = body.reviewed
        s.reviewed_by = user.id if body.reviewed else None
    detail["resolved"] = sorted(resolved)
    s.omr_detail = detail
    evaluate(db, s, exam)
    if changes:
        db.add(AuditLog(exam_id=exam.id, submission_id=s.id, user_id=user.id, action="edit", detail=changes))
    db.commit()
    return _full(db, s)


@router.post("/submissions/{sub_id}/reset", response_model=SubmissionOut)
def reset_submission(sub_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Khôi phục kết quả máy đọc ban đầu (bỏ mọi chỉnh sửa tay)."""
    s = _get_sub(db, user, sub_id)
    s.sbd, s.exam_code, s.answers = s.omr_sbd, s.omr_exam_code, list(s.omr_answers)
    s.reviewed, s.reviewed_by = False, None
    s.omr_detail = {**(s.omr_detail or {}), "resolved": []}
    evaluate(db, s, s.exam)
    db.add(AuditLog(exam_id=s.exam_id, submission_id=s.id, user_id=user.id, action="reset", detail={}))
    db.commit()
    return _full(db, s)


@router.delete("/submissions/{sub_id}")
def delete_submission(sub_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    s = _get_sub(db, user, sub_id)
    exam, sbd = s.exam, s.sbd
    for rel in (s.image_original, s.image_warped, s.image_annotated):
        p = image_path(rel)
        if p:
            p.unlink(missing_ok=True)
    db.add(AuditLog(exam_id=exam.id, user_id=user.id, action="delete_submission", detail={"id": s.id, "sbd": sbd}))
    db.delete(s)
    db.flush()
    for other in db.scalars(select(Submission).where(Submission.exam_id == exam.id, Submission.sbd == sbd)):
        evaluate(db, other, exam, regenerate_image=False)
    db.commit()
    return {"ok": True}


@router.get("/submissions/{sub_id}/history")
def history(sub_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    s = _get_sub(db, user, sub_id)
    logs = db.scalars(select(AuditLog).where(AuditLog.submission_id == s.id).order_by(AuditLog.id.desc()))
    return [{"id": a.id, "action": a.action, "detail": a.detail,
             "user": (a.user.full_name or a.user.username) if a.user else "", "created_at": a.created_at} for a in logs]


@router.get("/submissions/{sub_id}/image/{kind}")
def image(sub_id: int, kind: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if kind not in ("original", "warped", "annotated"):
        raise HTTPException(404)
    s = _get_sub(db, user, sub_id)
    p = image_path(getattr(s, f"image_{kind}"))
    if p is None:
        raise HTTPException(404, "Không có ảnh")
    return FileResponse(p, media_type="image/jpeg", headers={"Cache-Control": "private, max-age=60"})
