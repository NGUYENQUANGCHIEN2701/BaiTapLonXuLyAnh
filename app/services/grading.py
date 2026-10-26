"""Nghiệp vụ chấm bài: chạy OMR, lưu ảnh, ghép thí sinh, tính điểm, xác định trạng thái."""
from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np
from sqlalchemy import select
from sqlalchemy.orm import Session

from omr import OMRResult, process_image, score_answers
from omr.preprocess import limit_size
from omr.reader import ItemRead
from omr.visualize import annotate

from ..config import STORE_MAX_SIDE, UPLOAD_DIR
from ..models import AnswerKey, AuditLog, Exam, Student, Submission

BUSINESS_KINDS = {"unknown_student", "unknown_code", "no_key", "duplicate"}


# ---- Lưu / đọc ảnh --------------------------------------------------------------

def _exam_dir(exam_id: int) -> Path:
    d = UPLOAD_DIR / f"exam_{exam_id}"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _save_jpg(path: Path, img: np.ndarray, quality: int = 90) -> str:
    cv2.imwrite(str(path), img, [cv2.IMWRITE_JPEG_QUALITY, quality])
    return path.relative_to(UPLOAD_DIR).as_posix()


def image_path(rel: str) -> Path | None:
    if not rel:
        return None
    p = (UPLOAD_DIR / rel).resolve()
    if UPLOAD_DIR.resolve() not in p.parents or not p.exists():
        return None
    return p


# ---- Chi tiết OMR <-> JSON ------------------------------------------------------

def detail_from_result(r: OMRResult) -> dict:
    rd = r.read
    return {
        "ppm": 6.0,
        "width": int(r.warped.shape[1]),
        "height": int(r.warped.shape[0]),
        "global_threshold": round(rd.global_threshold, 1),
        "global_jump": round(rd.global_jump, 1),
        "shifts": {k: [round(v[0], 1), round(v[1], 1), round(v[2], 3)] for k, v in rd.block_shifts.items()},
        "qr": r.qr,
        "verify_score": round(r.align.verify_score, 3) if r.align else None,
        "flags": [f.to_dict() for f in r.flags],
        "resolved": [],
        "items": [
            {
                "block": it.block,
                "key": it.key,
                "labels": it.labels,
                "values": [round(v, 1) for v in it.values],
                "centers": [[round(x, 1), round(y, 1)] for x, y in it.centers],
                "radius": round(it.radius, 2),
                "threshold": round(it.threshold, 1),
                "marked": it.marked,
                "uncertain": it.uncertain,
            }
            for it in rd.items
        ],
    }


def items_from_detail(detail: dict) -> list[ItemRead]:
    return [
        ItemRead(d["block"], d["key"], d["labels"], d["values"], [tuple(c) for c in d["centers"]],
                 d["radius"], d["threshold"], d["marked"], d["uncertain"])
        for d in detail.get("items", [])
    ]


# ---- Tính điểm & trạng thái -----------------------------------------------------

def key_for(db: Session, exam: Exam, code: str) -> AnswerKey | None:
    return db.scalar(select(AnswerKey).where(AnswerKey.exam_id == exam.id, AnswerKey.code == code))


def evaluate(db: Session, sub: Submission, exam: Exam, regenerate_image: bool = True) -> None:
    """Tính lại điểm, ghép thí sinh và trạng thái dựa trên đáp án hiện tại của bài làm."""
    if sub.status == "error" and not sub.omr_detail:
        return
    flags: list[dict] = []
    detail = sub.omr_detail or {}
    if not sub.reviewed:
        resolved = set(detail.get("resolved", []))
        flags += [f for f in detail.get("flags", []) if f["field"] not in resolved]

    # ghép thí sinh theo SBD
    student = None
    if sub.sbd and sub.sbd.isdigit():
        student = db.scalar(select(Student).where(Student.exam_id == exam.id, Student.sbd == sub.sbd))
    sub.student_id = student.id if student else None
    has_roster = db.scalar(select(Student.id).where(Student.exam_id == exam.id).limit(1)) is not None
    if has_roster and student is None:
        flags.append({"field": "sbd", "kind": "unknown_student", "message": f"Không có thí sinh SBD {sub.sbd or '?'} trong danh sách"})

    # trùng SBD
    if sub.sbd and sub.sbd.isdigit():
        dup = db.scalar(select(Submission.id).where(
            Submission.exam_id == exam.id, Submission.sbd == sub.sbd, Submission.id != sub.id, Submission.status != "error"))
        if dup:
            flags.append({"field": "sbd", "kind": "duplicate", "message": f"SBD {sub.sbd} đã có bài làm khác (#{dup})"})

    # tra đáp án theo mã đề
    key = key_for(db, exam, sub.exam_code) if sub.exam_code else None
    if key is None:
        any_key = db.scalar(select(AnswerKey.id).where(AnswerKey.exam_id == exam.id).limit(1))
        if any_key is None:
            flags.append({"field": "code", "kind": "no_key", "message": "Kỳ thi chưa có đáp án"})
        else:
            flags.append({"field": "code", "kind": "unknown_code", "message": f"Không có đáp án cho mã đề {sub.exam_code or '?'}"})
        sub.score, sub.num_correct = None, None
    else:
        s = score_answers(sub.answers, key.answers[: exam.num_questions], exam.max_score)
        sub.score, sub.num_correct = s["score"], s["correct"]

    sub.flags = flags
    blocking = [f for f in flags if f["kind"] != "warning"]
    sub.status = "review" if blocking else "graded"

    if regenerate_image and sub.image_warped:
        p = image_path(sub.image_warped)
        if p is not None:
            warped = cv2.imread(str(p))
            out = annotate(warped, items_from_detail(detail), key.answers if key else None, sub.answers)
            name = Path(sub.image_warped).name.replace("_warp", "_annot")
            sub.image_annotated = _save_jpg(_exam_dir(exam.id) / name, out, 88)


def refresh_exam(db: Session, exam: Exam) -> int:
    """Tính lại toàn bộ bài làm của kỳ thi (khi đổi đáp án / danh sách thí sinh)."""
    subs = db.scalars(select(Submission).where(Submission.exam_id == exam.id)).all()
    for s in subs:
        evaluate(db, s, exam, regenerate_image=True)
    db.commit()
    return len(subs)


# ---- Chấm ảnh tải lên -----------------------------------------------------------

def grade_image(db: Session, exam: Exam, img: np.ndarray, source_name: str, user_id: int | None) -> Submission:
    r = process_image(img, exam.num_questions, exam.num_options, expected_exam_id=exam.id)
    sub = Submission(exam_id=exam.id, source_name=source_name[:255])
    db.add(sub)
    db.flush()  # lấy id để đặt tên file

    d = _exam_dir(exam.id)
    small, _ = limit_size(img, STORE_MAX_SIDE)
    sub.image_original = _save_jpg(d / f"sub_{sub.id}_orig.jpg", small, 88)
    sub.elapsed_ms = r.elapsed_ms
    if not r.ok:
        sub.status, sub.error = "error", r.error
        sub.flags = [{"field": "sheet", "kind": "error", "message": r.error}]
        db.add(AuditLog(exam_id=exam.id, submission_id=sub.id, user_id=user_id, action="upload", detail={"error": r.error}))
        return sub

    sub.image_warped = _save_jpg(d / f"sub_{sub.id}_warp.jpg", r.warped, 92)
    sub.omr_sbd = sub.sbd = r.sbd
    sub.omr_exam_code = sub.exam_code = r.exam_code
    answers = r.answers[: exam.num_questions]
    answers += [""] * (exam.num_questions - len(answers))
    sub.omr_answers, sub.answers = answers, list(answers)
    sub.confidence = r.confidence
    sub.align_method = r.align.method
    sub.rotation = r.align.rotation
    sub.omr_detail = detail_from_result(r)
    if r.num_questions != exam.num_questions:
        sub.omr_detail["flags"].append({"field": "sheet", "kind": "mismatch",
                                        "message": f"Phiếu in cho {r.num_questions} câu, kỳ thi có {exam.num_questions} câu"})
    evaluate(db, sub, exam)
    if sub.sbd.isdigit():  # bài cũ cùng SBD cũng phải được gắn cờ trùng
        for other in db.scalars(select(Submission).where(
                Submission.exam_id == exam.id, Submission.sbd == sub.sbd, Submission.id != sub.id)):
            evaluate(db, other, exam, regenerate_image=False)
    db.add(AuditLog(exam_id=exam.id, submission_id=sub.id, user_id=user_id, action="upload",
                    detail={"source": source_name, "sbd": sub.sbd, "code": sub.exam_code, "score": sub.score}))
    return sub


def answers_from_sheet(exam: Exam, img: np.ndarray) -> tuple[str, list[str], OMRResult]:
    """Đọc một phiếu do giáo viên tô sẵn làm đáp án -> (mã đề, đáp án)."""
    r = process_image(img, exam.num_questions, exam.num_options, expected_exam_id=exam.id)
    if not r.ok:
        raise ValueError(r.error)
    if not r.exam_code.isdigit():
        raise ValueError("Không đọc được mã đề trên phiếu đáp án")
    return r.exam_code, r.answers[: exam.num_questions], r
