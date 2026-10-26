"""Thống kê kết quả thi và phân tích câu hỏi (item analysis)."""
from __future__ import annotations

import statistics
from collections import Counter, defaultdict

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import AnswerKey, Exam, Student, Submission


def _difficulty_label(p: float) -> str:
    if p >= 0.7:
        return "Dễ"
    if p >= 0.3:
        return "Trung bình"
    return "Khó"


def _discrimination_label(d: float) -> str:
    # Thang Ebel (1972)
    if d >= 0.4:
        return "Rất tốt"
    if d >= 0.3:
        return "Tốt"
    if d >= 0.2:
        return "Tạm được"
    return "Kém"


def exam_stats(db: Session, exam: Exam, code: str | None = None) -> dict:
    subs = db.scalars(select(Submission).where(Submission.exam_id == exam.id)).all()
    students = {s.id: s for s in db.scalars(select(Student).where(Student.exam_id == exam.id))}
    keys = {k.code: k.answers for k in db.scalars(select(AnswerKey).where(AnswerKey.exam_id == exam.id))}
    scored = [s for s in subs if s.score is not None]
    scores = [s.score for s in scored]

    by_status = Counter(s.status for s in subs)
    overview = {
        "total": len(subs),
        "graded": by_status.get("graded", 0),
        "review": by_status.get("review", 0),
        "error": by_status.get("error", 0),
        "scored": len(scores),
        "roster": len(students),
        "absent": len(set(students) - {s.student_id for s in subs if s.student_id}),
        "mean": round(statistics.mean(scores), 2) if scores else None,
        "median": round(statistics.median(scores), 2) if scores else None,
        "stdev": round(statistics.pstdev(scores), 2) if len(scores) > 1 else None,
        "min": min(scores) if scores else None,
        "max": max(scores) if scores else None,
        "pass_rate": round(sum(sc >= exam.pass_score for sc in scores) / len(scores), 4) if scores else None,
        "max_score": exam.max_score,
        "pass_score": exam.pass_score,
    }

    # phổ điểm: 10 khoảng đều
    step = exam.max_score / 10
    hist = [0] * 10
    for sc in scores:
        hist[min(9, int(sc / step + 1e-9))] += 1
    histogram = [{"range": f"{i * step:g}–{(i + 1) * step:g}", "from": i * step, "count": c} for i, c in enumerate(hist)]

    # theo lớp và theo mã đề
    groups: dict[str, list[float]] = defaultdict(list)
    for s in scored:
        st = students.get(s.student_id)
        groups[st.class_name if st and st.class_name else "(Không rõ)"].append(s.score)
    by_class = [{"name": k, "count": len(v), "mean": round(statistics.mean(v), 2),
                 "pass_rate": round(sum(x >= exam.pass_score for x in v) / len(v), 4)} for k, v in sorted(groups.items())]
    code_groups: dict[str, list[float]] = defaultdict(list)
    for s in scored:
        code_groups[s.exam_code].append(s.score)
    by_code = [{"code": k, "count": len(v), "mean": round(statistics.mean(v), 2)} for k, v in sorted(code_groups.items())]

    # phân tích câu hỏi cho một mã đề (mỗi mã đề có thứ tự câu khác nhau)
    codes_available = [c["code"] for c in sorted(by_code, key=lambda c: -c["count"]) if c["code"] in keys]
    if code is None and codes_available:
        code = codes_available[0]
    items = []
    if code in keys:
        key = keys[code][: exam.num_questions]
        group = sorted((s for s in scored if s.exam_code == code), key=lambda s: s.score, reverse=True)
        n = len(group)
        k27 = max(1, round(n * 0.27)) if n >= 4 else 0
        upper, lower = group[:k27], group[-k27:] if k27 else []
        for q in range(exam.num_questions):
            k = key[q] if q < len(key) else ""
            answers = [(s.answers[q] if q < len(s.answers) else "") for s in group]
            cnt = Counter(a if len(a) <= 1 else "multi" for a in answers)
            correct = sum(a == k for a in answers)
            p = correct / n if n else 0.0
            d = None
            if k27:
                pu = sum((s.answers[q] if q < len(s.answers) else "") == k for s in upper) / k27
                pl = sum((s.answers[q] if q < len(s.answers) else "") == k for s in lower) / k27
                d = round(pu - pl, 3)
            options = {o: cnt.get(o, 0) for o in "ABCDEF"[: exam.num_options]}
            items.append({
                "q": q + 1,
                "key": k,
                "p": round(p, 3),
                "difficulty": _difficulty_label(p),
                "d": d,
                "discrimination": _discrimination_label(d) if d is not None else None,
                "options": options,
                "blank": cnt.get("", 0),
                "multi": cnt.get("multi", 0),
                # phương án nhiễu được chọn nhiều nhất
                "top_distractor": max(((o, c) for o, c in options.items() if o != k), key=lambda t: t[1], default=(None, 0))[0],
            })

    ranking = sorted(scored, key=lambda s: (-(s.score or 0), s.sbd))[:10]
    top = [{
        "submission_id": s.id, "sbd": s.sbd, "score": s.score, "num_correct": s.num_correct,
        "name": students[s.student_id].full_name if s.student_id in students else "",
        "class_name": students[s.student_id].class_name if s.student_id in students else "",
    } for s in ranking]

    return {"overview": overview, "histogram": histogram, "by_class": by_class, "by_code": by_code,
            "item_code": code, "codes": codes_available, "items": items, "top": top}
