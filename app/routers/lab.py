"""Phòng thí nghiệm xử lý ảnh: trình bày từng bước của pipeline (phục vụ báo cáo/thuyết trình),
phát hiện marker thời gian thực cho webcam, và sinh dữ liệu demo."""
from __future__ import annotations

import base64
import random
import time

import cv2
import numpy as np
from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from omr import layout as L
from omr import synth
from omr.alignment import DETECT_MAX_SIDE, align, find_marker_candidates, warp
from omr.pipeline import decode_qr_from, load_image_bytes, process_image
from omr.preprocess import binarize_dark, estimate_background, limit_size, normalize_illumination, to_gray
from omr.reader import ReaderConfig, find_jump_threshold, read_bubbles
from omr.visualize import annotate, draw_detection

from ..db import get_db
from ..models import AnswerKey, Student, User
from ..security import current_user, get_exam_for
from ..services.grading import grade_image, refresh_exam

router = APIRouter(prefix="/api", tags=["lab"])


def _b64(img: np.ndarray, max_side: int = 1100, quality: int = 85) -> str:
    small, _ = limit_size(img, max_side)
    ok, enc = cv2.imencode(".jpg", small, [cv2.IMWRITE_JPEG_QUALITY, quality])
    return "data:image/jpeg;base64," + base64.b64encode(enc.tobytes()).decode()


def _value_heatmap(warped: np.ndarray, rd) -> np.ndarray:
    """Tô màu từng ô theo độ sáng đo được: đỏ = tối (đã tô), xanh = sáng (trống)."""
    out = cv2.cvtColor(to_gray(warped), cv2.COLOR_GRAY2BGR)
    out = cv2.addWeighted(out, 0.5, np.full_like(out, 255), 0.5, 0)
    for it in rd.items:
        for (x, y), v in zip(it.centers, it.values):
            t = float(np.clip(v / 255.0, 0, 1))
            color = (int(255 * t), int(80 + 80 * t), int(255 * (1 - t)))
            cv2.circle(out, (int(x), int(y)), int(it.radius * 0.62), color, -1, cv2.LINE_AA)
            cv2.circle(out, (int(x), int(y)), int(it.radius), (40, 40, 40), 1, cv2.LINE_AA)
    return out


def _alignment_view(warped: np.ndarray, sheet: L.SheetLayout, shifts: dict, ppm: float) -> np.ndarray:
    """Khung lý thuyết (đỏ) và khung sau khi căn chỉnh tinh (xanh) của từng khối."""
    out = warped.copy()
    for b in sheet.blocks:
        dx, dy, _ = shifts.get(b.name, (0, 0, 0))
        r = b.box
        p0, p1 = (int(r.x * ppm), int(r.y * ppm)), (int((r.x + r.w) * ppm), int((r.y + r.h) * ppm))
        cv2.rectangle(out, p0, p1, (40, 40, 230), 2)
        cv2.rectangle(out, (int(p0[0] + dx), int(p0[1] + dy)), (int(p1[0] + dx), int(p1[1] + dy)), (60, 170, 40), 2)
        cv2.putText(out, f"{dx:+.0f},{dy:+.0f}px", (p0[0] + 4, p0[1] - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (60, 120, 40), 1)
    return out


@router.post("/lab/analyze")
async def analyze(file: UploadFile = File(...), num_questions: int | None = Form(None), num_options: int | None = Form(None),
                  _: User = Depends(current_user)):
    try:
        image = load_image_bytes(await file.read())[0]
    except ValueError as e:
        raise HTTPException(400, str(e))
    cfg = ReaderConfig()
    steps = []
    t = time.perf_counter()

    def step(key, title, desc, img, **extra):
        nonlocal t
        now = time.perf_counter()
        steps.append({"key": key, "title": title, "description": desc, "image": _b64(img) if img is not None else None,
                      "ms": round((now - t) * 1000, 1), **extra})
        t = time.perf_counter()

    step("input", "Ảnh đầu vào", f"Kích thước {image.shape[1]}×{image.shape[0]} px.", image)
    gray_full = to_gray(image)
    gray, s = limit_size(gray_full, DETECT_MAX_SIDE)
    step("gray", "Ảnh xám", "Chuyển sang ảnh xám (Y = 0.299R + 0.587G + 0.114B) và thu nhỏ để tăng tốc phát hiện.", gray)
    bg = estimate_background(gray)
    step("background", "Ước lượng nền giấy",
         "Phép đóng hình thái học (giãn rồi co) với phần tử cấu trúc lớn xóa mọi nét mực, chỉ còn lại sự biến thiên "
         "chậm của ánh sáng (bóng đổ, vùng tối).", bg)
    norm = normalize_illumination(gray)
    step("normalized", "Chuẩn hóa độ sáng", "Chia ảnh xám cho nền: I' = I / nền × 255 → giấy trắng đồng đều, loại bỏ bóng đổ.", norm)
    binary, thr = binarize_dark(norm)
    binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
    step("binary", "Nhị phân hóa (Otsu)", f"Ngưỡng Otsu = {thr:.0f}, sau đó mở hình thái (2×2) để khử nhiễu hạt.", binary)

    al = align(image, cfg.ppm)
    cands = find_marker_candidates(binary)
    step("markers", "Tìm 4 marker góc",
         f"Contour → lọc hình vuông (xấp xỉ đa giác 4 đỉnh, độ đặc, tỉ lệ cạnh) được {len(cands)} ứng viên (vàng). "
         f"Chọn bộ 4 điểm tạo tứ giác hợp lệ lớn nhất rồi kiểm chứng bằng so khớp hình mẫu (điểm khớp = "
         f"{al.verify_score:.2f}). Marker rỗng (đỏ) xác định góc trên-trái → phiếu xoay {al.rotation}°.",
         draw_detection(image, al), method=al.method, verify_score=round(al.verify_score, 3))
    if not al.ok:
        return {"ok": False, "error": al.error, "steps": steps}

    warped = warp(image, al.homography, cfg.ppm)
    step("warped", "Nắn phối cảnh (homography)",
         "Từ 4 cặp điểm (tâm marker trên ảnh ↔ tọa độ chuẩn trên giấy A4) giải ma trận H 3×3, rồi warpPerspective về "
         f"ảnh chuẩn {warped.shape[1]}×{warped.shape[0]} px ({cfg.ppm:g} px/mm).", warped,
         homography=[[round(v, 5) for v in row] for row in al.homography.tolist()])

    qr = decode_qr_from(image, al, cfg.ppm)
    nq = qr["num_questions"] if qr else num_questions
    no = (qr["num_options"] if qr else num_options) or 4
    if not nq:
        return {"ok": False, "error": "Không đọc được QR — hãy nhập số câu của phiếu.", "steps": steps}
    sheet = L.build_layout(nq, no)
    step("qr", "Đọc mã QR", f"QR: {qr}" if qr else "Không đọc được QR, dùng cấu hình nhập tay.", None, qr=qr)

    rd = read_bubbles(to_gray(warped), sheet, cfg)
    step("align_blocks", "Căn chỉnh tinh từng khối",
         "Template matching (TM_CCOEFF_NORMED) giữa ảnh mực và hình vẽ lý thuyết của từng khối trong phạm vi ±"
         f"{cfg.align_margin_mm} mm, bù sai lệch do giấy cong. Đỏ: vị trí lý thuyết, xanh: vị trí sau căn chỉnh.",
         _alignment_view(warped, sheet, rd.block_shifts, cfg.ppm),
         shifts={k: [round(v[0], 1), round(v[1], 1), round(v[2], 3)] for k, v in rd.block_shifts.items()})
    vals = [v for it in rd.items for v in it.values]
    step("values", "Đo độ sáng từng ô",
         f"Lấy trung bình mức xám trong lõi mỗi ô (bán kính {cfg.core_ratio:.0%}) trên ảnh đã chuẩn hóa — "
         f"{len(vals)} ô. Đỏ = tối (đã tô), xanh = sáng (trống).", _value_heatmap(warped, rd))
    g_thr, g_jump = find_jump_threshold(vals, cfg.min_jump, cfg.default_threshold)
    step("threshold", "Ngưỡng 'bước nhảy lớn nhất'",
         f"Sắp xếp {len(vals)} giá trị, tìm khoảng nhảy lớn nhất → ngưỡng toàn cục {g_thr:.1f} (bước nhảy {g_jump:.1f}). "
         "Mỗi câu được tinh chỉnh ngưỡng cục bộ trong dải ±22% bước nhảy (kế thừa ý tưởng OMRChecker).", None,
         sorted_values=[round(v, 1) for v in sorted(vals)], threshold=round(g_thr, 1), jump=round(g_jump, 1))
    r = process_image(image, nq, no)
    step("result", "Kết quả", f"SBD {r.sbd} · Mã đề {r.exam_code} · {len(r.flags)} cảnh báo · độ tin cậy {r.confidence:.0%}.",
         annotate(r.warped, r.read.items) if r.ok else None,
         sbd=r.sbd, exam_code=r.exam_code, answers=r.answers, flags=[f.to_dict() for f in r.flags])
    return {"ok": True, "steps": steps, "summary": r.summary()}


@router.get("/lab/sample")
def sample(seed: int = 0, strength: float = 1.0, questions: int = 40, _: User = Depends(current_user)):
    """Ảnh mẫu: phiếu tô ngẫu nhiên + mô phỏng chụp điện thoại (để thử phòng thí nghiệm)."""
    questions = max(1, min(L.MAX_QUESTIONS, questions))
    blank = synth.render_blank(0, questions, 4, "Ảnh mẫu")
    filled, _ = synth.fill_sheet(blank, questions, seed=seed)
    photo, _ = synth.photograph(filled, seed=seed, strength=max(0.0, min(2.0, strength)))
    ok, enc = cv2.imencode(".jpg", photo, [cv2.IMWRITE_JPEG_QUALITY, 88])
    return Response(enc.tobytes(), media_type="image/jpeg")


@router.post("/lab/detect")
async def detect(file: UploadFile = File(...), _: User = Depends(current_user)):
    """Phát hiện nhanh 4 marker trên khung hình webcam -> tọa độ chuẩn hóa (0..1) để vẽ khung."""
    data = await file.read()
    img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(400, "Ảnh không hợp lệ")
    t0 = time.perf_counter()
    al = align(img, 3.0)
    h, w = img.shape[:2]
    pts = [[x / w, y / h] for x, y in al.markers] if al.ok and al.markers else []
    return {"ok": al.ok and len(pts) == 4 and al.verify_score >= 0.35, "markers": pts,
            "verify_score": round(al.verify_score, 3), "ms": round((time.perf_counter() - t0) * 1000, 1)}


@router.post("/exams/{exam_id}/demo")
def demo_data(exam_id: int, n: int = 20, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Sinh dữ liệu demo: danh sách thí sinh, đáp án (nếu chưa có) và n ảnh phiếu chụp mô phỏng."""
    exam = get_exam_for(user, exam_id, db)
    n = max(1, min(n, 100))
    rng = random.Random(exam.id * 1000 + n)
    opts = L.OPTION_LABELS[: exam.num_options]
    keys = {k.code: k.answers for k in db.scalars(select(AnswerKey).where(AnswerKey.exam_id == exam.id))}
    if not keys:
        for code in ("101", "102", "103"):
            ans = [rng.choice(opts) for _ in range(exam.num_questions)]
            db.add(AnswerKey(exam_id=exam.id, code=code, answers=ans))
            keys[code] = ans
    students = db.scalars(select(Student).where(Student.exam_id == exam.id)).all()
    if len(students) < n:
        ho = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Vũ", "Đặng", "Bùi", "Đỗ", "Ngô"]
        dem = ["Văn", "Thị", "Minh", "Thu", "Đức", "Ngọc", "Quang", "Thanh", "Hải", "Bảo"]
        ten = ["An", "Bình", "Chi", "Dũng", "Giang", "Hà", "Khánh", "Linh", "Nam", "Phương", "Quân", "Sơn", "Trang", "Vy"]
        used = {s.sbd for s in students}
        k = 1
        while len(students) < n:
            sbd = f"{k:06d}"
            k += 1
            if sbd in used:
                continue
            st = Student(exam_id=exam.id, sbd=sbd, full_name=f"{rng.choice(ho)} {rng.choice(dem)} {rng.choice(ten)}",
                         class_name=rng.choice(["12A1", "12A2", "12A3"]), room=f"P{101 + len(students) // 25}")
            db.add(st)
            students.append(st)
        db.flush()
    db.commit()

    blank = synth.render_blank(exam.id, exam.num_questions, exam.num_options, exam.name)
    difficulty = [rng.uniform(-0.25, 0.25) for _ in range(exam.num_questions)]
    taken = {s.student_id for s in exam.submissions}
    created = []
    for st in [s for s in students if s.id not in taken][:n]:
        code = rng.choice(sorted(keys))
        key = keys[code]
        ability = min(0.97, max(0.15, rng.gauss(0.66, 0.17)))
        answers = []
        for q in range(exam.num_questions):
            if rng.random() < 0.02:
                answers.append("")
            elif rng.random() < ability + difficulty[q]:
                answers.append(key[q] or rng.choice(opts))
            else:
                answers.append(rng.choice([o for o in opts if o != key[q]] or opts))
        # vài tình huống thực tế để minh họa quy trình duyệt bài
        erased: list[int] = []
        if rng.random() < 0.12:  # tô 2 ô ở một câu
            q = rng.randrange(exam.num_questions)
            answers[q] = "".join(sorted(set(answers[q] + rng.choice(opts)))) if answers[q] else rng.choice(opts)
        if rng.random() < 0.15:  # tẩy chưa sạch
            erased.append(rng.randrange(exam.num_questions))
        sbd = st.sbd
        if rng.random() < 0.05:  # tô nhầm số báo danh
            sbd = f"{rng.randrange(900000, 999999)}"
        filled = blank.copy()
        _fill_exact(filled, exam, sbd, code, answers, rng, erased)
        photo, _ = synth.photograph(filled, seed=rng.randrange(1 << 30), strength=rng.uniform(0.3, 1.1))
        sub = grade_image(db, exam, photo, f"demo_{sbd}.jpg", user.id)
        db.commit()
        created.append(sub.id)
    refresh_exam(db, exam)
    return {"created": len(created), "students": len(students), "keys": sorted(keys)}


def _fill_exact(img: np.ndarray, exam, sbd: str, code: str, answers: list[str], rng: random.Random,
                erased: list[int] = ()) -> None:
    sheet = L.build_layout(exam.num_questions, exam.num_options)
    ppm = img.shape[1] / L.PAGE_W
    dark = rng.randint(25, 80)
    for block, value in ((sheet.sbd, sbd), (sheet.code, code)):
        for col, d in zip(block.items, value):
            synth._pencil(img, col[int(d)], ppm, rng, dark)
    for qi, (row, a) in enumerate(zip(sheet.question_bubbles(), answers)):
        if qi in erased:
            free = [b for b in row if b.label not in a]
            if free:
                synth._pencil(img, rng.choice(free), ppm, rng, rng.randint(150, 180), coverage=0.9)
        for b in row:
            if b.label in a:
                synth._pencil(img, b, ppm, rng, dark + rng.randint(-10, 15))
