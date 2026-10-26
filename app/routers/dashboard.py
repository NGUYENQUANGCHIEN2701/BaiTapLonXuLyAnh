from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import AuditLog, Exam, Submission, User
from ..security import current_user

router = APIRouter(prefix="/api", tags=["dashboard"])


@router.get("/dashboard")
def dashboard(user: User = Depends(current_user), db: Session = Depends(get_db)):
    exam_ids = select(Exam.id)
    if user.role != "admin":
        exam_ids = exam_ids.where(Exam.owner_id == user.id)
    in_scope = Submission.exam_id.in_(exam_ids)
    count = lambda *c: db.scalar(select(func.count()).select_from(Submission).where(in_scope, *c))  # noqa: E731
    recent = db.scalars(select(Submission).where(in_scope).order_by(Submission.id.desc()).limit(8)).all()
    exams = db.scalars(select(Exam).where(Exam.id.in_(exam_ids)).order_by(Exam.id.desc()).limit(6)).all()
    logs = db.scalars(select(AuditLog).where(AuditLog.exam_id.in_(exam_ids)).order_by(AuditLog.id.desc()).limit(10)).all()
    per_exam = []
    for e in exams:
        avg = db.scalar(select(func.avg(Submission.score)).where(Submission.exam_id == e.id))
        n = db.scalar(select(func.count()).select_from(Submission).where(Submission.exam_id == e.id))
        per_exam.append({"id": e.id, "name": e.name, "subject": e.subject, "count": n,
                         "avg": round(avg, 2) if avg is not None else None})
    return {
        "exams": db.scalar(select(func.count()).select_from(Exam).where(Exam.id.in_(exam_ids))),
        "submissions": count(),
        "review": count(Submission.status == "review"),
        "errors": count(Submission.status == "error"),
        "avg_score": db.scalar(select(func.avg(Submission.score)).where(in_scope)),
        "avg_ms": db.scalar(select(func.avg(Submission.elapsed_ms)).where(in_scope)),
        "per_exam": per_exam,
        "recent": [{"id": s.id, "exam_id": s.exam_id, "exam_name": s.exam.name, "sbd": s.sbd, "score": s.score,
                    "status": s.status, "name": s.student.full_name if s.student else "", "created_at": s.created_at}
                   for s in recent],
        "activity": [{"id": a.id, "action": a.action, "detail": a.detail, "exam_id": a.exam_id,
                      "submission_id": a.submission_id, "user": (a.user.full_name or a.user.username) if a.user else "",
                      "created_at": a.created_at} for a in logs],
    }
