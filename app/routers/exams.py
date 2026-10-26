from __future__ import annotations

import shutil
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from omr import layout as L
from omr.pipeline import load_image_bytes
from omr.sheet_pdf import SheetInfo, render_pdf, render_png

from ..config import UPLOAD_DIR
from ..db import get_db
from ..models import AnswerKey, AuditLog, Exam, Student, Submission, User
from ..schemas import (ExamCreate, ExamOut, ExamSummary, ExamUpdate, KeyIn, KeyOut, StudentIn, StudentOut,
                       StudentWithResult)
from ..security import current_user, get_exam_for
from ..services import excel
from ..services.grading import answers_from_sheet, refresh_exam
from ..services.stats import exam_stats

router = APIRouter(prefix="/api/exams", tags=["exams"])

XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _download(data: bytes, filename: str, media: str) -> Response:
    return Response(data, media_type=media,
                    headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"})


def _summary(db: Session, exam: Exam) -> ExamSummary:
    q = lambda *conds: db.scalar(select(func.count()).select_from(Submission).where(Submission.exam_id == exam.id, *conds))  # noqa: E731
    return ExamSummary(
        **ExamOut.model_validate(exam).model_dump(),
        num_keys=db.scalar(select(func.count()).select_from(AnswerKey).where(AnswerKey.exam_id == exam.id)),
        num_students=db.scalar(select(func.count()).select_from(Student).where(Student.exam_id == exam.id)),
        num_submissions=q(),
        num_review=q(Submission.status == "review"),
        avg_score=db.scalar(select(func.avg(Submission.score)).where(Submission.exam_id == exam.id)),
        owner_name=exam.owner.full_name or exam.owner.username if exam.owner else "",
    )


# ---- Kỳ thi ---------------------------------------------------------------------

@router.get("", response_model=list[ExamSummary])
def list_exams(user: User = Depends(current_user), db: Session = Depends(get_db)):
    stmt = select(Exam).order_by(Exam.created_at.desc(), Exam.id.desc())
    if user.role != "admin":
        stmt = stmt.where(Exam.owner_id == user.id)
    return [_summary(db, e) for e in db.scalars(stmt)]


@router.post("", response_model=ExamSummary)
def create_exam(body: ExamCreate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    exam = Exam(**body.model_dump(), owner_id=user.id)
    db.add(exam)
    db.flush()
    db.add(AuditLog(exam_id=exam.id, user_id=user.id, action="create_exam", detail={"name": exam.name}))
    db.commit()
    return _summary(db, exam)


@router.get("/{exam_id}", response_model=ExamSummary)
def get_exam(exam_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return _summary(db, get_exam_for(user, exam_id, db))


@router.put("/{exam_id}", response_model=ExamSummary)
def update_exam(exam_id: int, body: ExamUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    exam = get_exam_for(user, exam_id, db)
    data = body.model_dump(exclude_unset=True)
    if ("num_questions" in data or "num_options" in data) and exam.submissions:
        if data.get("num_questions", exam.num_questions) != exam.num_questions or \
           data.get("num_options", exam.num_options) != exam.num_options:
            raise HTTPException(400, "Không thể đổi số câu/số phương án khi đã có bài làm")
    for k, v in data.items():
        setattr(exam, k, v)
    db.commit()
    refresh_exam(db, exam)
    return _summary(db, exam)


@router.delete("/{exam_id}")
def delete_exam(exam_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    exam = get_exam_for(user, exam_id, db)
    db.delete(exam)
    db.commit()
    shutil.rmtree(UPLOAD_DIR / f"exam_{exam_id}", ignore_errors=True)
    return {"ok": True}


# ---- Phiếu trả lời --------------------------------------------------------------

def _sheet_infos(exam: Exam, db: Session, personalized: bool) -> list[SheetInfo]:
    base = dict(exam_id=exam.id, exam_name=exam.name, subject=exam.subject, exam_date=exam.exam_date)
    if not personalized:
        return [SheetInfo(**base)]
    students = db.scalars(select(Student).where(Student.exam_id == exam.id).order_by(Student.room, Student.sbd)).all()
    if not students:
        raise HTTPException(400, "Chưa có danh sách thí sinh để in phiếu cá nhân hóa")
    return [SheetInfo(**base, student_name=s.full_name, student_sbd=s.sbd, student_class=s.class_name, room=s.room)
            for s in students]


@router.get("/{exam_id}/sheet.pdf")
def sheet_pdf(exam_id: int, personalized: bool = False, copies: int = Query(1, ge=1, le=500),
              user: User = Depends(current_user), db: Session = Depends(get_db)):
    exam = get_exam_for(user, exam_id, db)
    infos = _sheet_infos(exam, db, personalized)
    if not personalized:
        infos = infos * copies
    pdf = render_pdf(L.build_layout(exam.num_questions, exam.num_options), infos)
    name = f"phieu_{exam.id}{'_ca_nhan' if personalized else ''}.pdf"
    return Response(pdf, media_type="application/pdf", headers={"Content-Disposition": f'inline; filename="{name}"'})


@router.get("/{exam_id}/sheet.png")
def sheet_png(exam_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    exam = get_exam_for(user, exam_id, db)
    pdf = render_pdf(L.build_layout(exam.num_questions, exam.num_options), _sheet_infos(exam, db, False))
    return Response(render_png(pdf, dpi=110), media_type="image/png")


# ---- Đáp án ---------------------------------------------------------------------

def _check_key(exam: Exam, answers: list[str]) -> list[str]:
    valid = set(L.OPTION_LABELS[: exam.num_options])
    answers = (answers + [""] * exam.num_questions)[: exam.num_questions]
    for i, a in enumerate(answers, 1):
        if a and (len(a) != 1 or a not in valid):
            raise HTTPException(400, f"Câu {i}: đáp án '{a}' không hợp lệ (chỉ {''.join(sorted(valid))})")
    return answers


@router.get("/{exam_id}/keys", response_model=list[KeyOut])
def list_keys(exam_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return get_exam_for(user, exam_id, db).keys


@router.post("/{exam_id}/keys", response_model=KeyOut)
def upsert_key(exam_id: int, body: KeyIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    exam = get_exam_for(user, exam_id, db)
    answers = _check_key(exam, body.answers)
    key = db.scalar(select(AnswerKey).where(AnswerKey.exam_id == exam.id, AnswerKey.code == body.code))
    if key is None:
        key = AnswerKey(exam_id=exam.id, code=body.code)
        db.add(key)
    key.answers = answers
    db.add(AuditLog(exam_id=exam.id, user_id=user.id, action="save_key", detail={"code": body.code}))
    db.commit()
    refresh_exam(db, exam)
    return key


@router.delete("/{exam_id}/keys/{key_id}")
def delete_key(exam_id: int, key_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    exam = get_exam_for(user, exam_id, db)
    key = db.get(AnswerKey, key_id)
    if key is None or key.exam_id != exam.id:
        raise HTTPException(404, "Không tìm thấy mã đề")
    db.delete(key)
    db.commit()
    refresh_exam(db, exam)
    return {"ok": True}


@router.post("/{exam_id}/keys/import")
async def import_keys(exam_id: int, file: UploadFile = File(...), user: User = Depends(current_user),
                      db: Session = Depends(get_db)):
    exam = get_exam_for(user, exam_id, db)
    rows = excel.read_table(await file.read(), file.filename or "")
    keys, errors = excel.parse_keys(rows, exam.num_questions)
    for code, answers in keys.items():
        answers = _check_key(exam, answers)
        k = db.scalar(select(AnswerKey).where(AnswerKey.exam_id == exam.id, AnswerKey.code == code))
        if k is None:
            db.add(AnswerKey(exam_id=exam.id, code=code, answers=answers))
        else:
            k.answers = answers
    db.commit()
    refresh_exam(db, exam)
    return {"imported": len(keys), "codes": sorted(keys), "errors": errors}


@router.post("/{exam_id}/keys/from-sheet")
async def key_from_sheet(exam_id: int, file: UploadFile = File(...), user: User = Depends(current_user),
                         db: Session = Depends(get_db)):
    """Giáo viên tô đáp án lên một phiếu trắng rồi chụp -> hệ thống đọc thành bộ đáp án."""
    exam = get_exam_for(user, exam_id, db)
    try:
        img = load_image_bytes(await file.read())[0]
        code, answers, r = answers_from_sheet(exam, img)
    except ValueError as e:
        raise HTTPException(400, str(e))
    warnings = [f.message for f in r.flags if f.field.startswith("q")]
    return {"code": code, "answers": answers, "warnings": warnings}


@router.get("/{exam_id}/keys/template.xlsx")
def keys_template(exam_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    exam = get_exam_for(user, exam_id, db)
    return _download(excel.key_template(exam.num_questions), "mau_dap_an.xlsx", XLSX)


# ---- Thí sinh -------------------------------------------------------------------

@router.get("/{exam_id}/students", response_model=list[StudentWithResult])
def list_students(exam_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    exam = get_exam_for(user, exam_id, db)
    subs = {s.student_id: s for s in db.scalars(select(Submission).where(
        Submission.exam_id == exam.id, Submission.student_id.is_not(None)).order_by(Submission.id))}
    out = []
    for st in db.scalars(select(Student).where(Student.exam_id == exam.id).order_by(Student.sbd)):
        sub = subs.get(st.id)
        out.append(StudentWithResult(**StudentOut.model_validate(st).model_dump(),
                                     submission_id=sub.id if sub else None,
                                     score=sub.score if sub else None, status=sub.status if sub else None))
    return out


@router.post("/{exam_id}/students", response_model=StudentOut)
def create_student(exam_id: int, body: StudentIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    exam = get_exam_for(user, exam_id, db)
    if db.scalar(select(Student).where(Student.exam_id == exam.id, Student.sbd == body.sbd)):
        raise HTTPException(400, f"SBD {body.sbd} đã tồn tại")
    st = Student(exam_id=exam.id, **body.model_dump())
    db.add(st)
    db.commit()
    refresh_exam(db, exam)
    return st


@router.put("/{exam_id}/students/{student_id}", response_model=StudentOut)
def update_student(exam_id: int, student_id: int, body: StudentIn, user: User = Depends(current_user),
                   db: Session = Depends(get_db)):
    exam = get_exam_for(user, exam_id, db)
    st = db.get(Student, student_id)
    if st is None or st.exam_id != exam.id:
        raise HTTPException(404, "Không tìm thấy thí sinh")
    other = db.scalar(select(Student).where(Student.exam_id == exam.id, Student.sbd == body.sbd, Student.id != st.id))
    if other:
        raise HTTPException(400, f"SBD {body.sbd} đã được dùng cho {other.full_name}")
    for k, v in body.model_dump().items():
        setattr(st, k, v)
    db.commit()
    refresh_exam(db, exam)
    return st


@router.delete("/{exam_id}/students/{student_id}")
def delete_student(exam_id: int, student_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    exam = get_exam_for(user, exam_id, db)
    st = db.get(Student, student_id)
    if st is None or st.exam_id != exam.id:
        raise HTTPException(404, "Không tìm thấy thí sinh")
    db.delete(st)
    db.commit()
    refresh_exam(db, exam)
    return {"ok": True}


@router.post("/{exam_id}/students/import")
async def import_students(exam_id: int, file: UploadFile = File(...), replace: bool = False,
                          user: User = Depends(current_user), db: Session = Depends(get_db)):
    exam = get_exam_for(user, exam_id, db)
    rows = excel.read_table(await file.read(), file.filename or "")
    parsed, errors = excel.parse_students(rows)
    if replace:
        for st in db.scalars(select(Student).where(Student.exam_id == exam.id)):
            db.delete(st)
        db.flush()
    existing = {s.sbd: s for s in db.scalars(select(Student).where(Student.exam_id == exam.id))}
    created = updated = 0
    for row in parsed:
        st = existing.get(row["sbd"])
        if st is None:
            st = Student(exam_id=exam.id, **row)
            db.add(st)
            existing[row["sbd"]] = st
            created += 1
        else:
            for k, v in row.items():
                setattr(st, k, v)
            updated += 1
    db.commit()
    refresh_exam(db, exam)
    return {"created": created, "updated": updated, "errors": errors}


@router.get("/{exam_id}/students/template.xlsx")
def students_template(exam_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    get_exam_for(user, exam_id, db)
    return _download(excel.student_template(), "mau_danh_sach_thi_sinh.xlsx", XLSX)


# ---- Thống kê & xuất kết quả ----------------------------------------------------

@router.get("/{exam_id}/stats")
def stats(exam_id: int, code: str | None = None, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return exam_stats(db, get_exam_for(user, exam_id, db), code)


@router.get("/{exam_id}/export.xlsx")
def export(exam_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    exam = get_exam_for(user, exam_id, db)
    subs = db.scalars(select(Submission).where(Submission.exam_id == exam.id).order_by(Submission.id)).all()
    students = db.scalars(select(Student).where(Student.exam_id == exam.id)).all()
    items = exam_stats(db, exam)["items"]
    data = excel.export_results(exam, list(subs), list(students), items)
    return _download(data, f"bang_diem_{exam.id}.xlsx", XLSX)


@router.get("/{exam_id}/activity")
def activity(exam_id: int, limit: int = 50, user: User = Depends(current_user), db: Session = Depends(get_db)):
    exam = get_exam_for(user, exam_id, db)
    logs = db.scalars(select(AuditLog).where(AuditLog.exam_id == exam.id).order_by(AuditLog.id.desc()).limit(limit))
    return [{"id": a.id, "action": a.action, "detail": a.detail, "submission_id": a.submission_id,
             "user": (a.user.full_name or a.user.username) if a.user else "", "created_at": a.created_at} for a in logs]
