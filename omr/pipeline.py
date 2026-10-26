"""Pipeline chấm một ảnh phiếu: căn chỉnh -> đọc QR -> đọc ô -> diễn giải kết quả."""
from __future__ import annotations

import time
from dataclasses import dataclass, field

import cv2
import numpy as np

from . import layout as L
from .alignment import AlignResult, align, warp, warp_region
from .preprocess import to_bgr, to_gray
from .reader import ItemRead, ReaderConfig, ReadResult, read_bubbles


@dataclass
class Flag:
    field: str      # "sbd", "code", "q12", "sheet"...
    kind: str       # blank | multiple | uncertain | invalid | warning | mismatch
    message: str

    def to_dict(self) -> dict:
        return {"field": self.field, "kind": self.kind, "message": self.message}


@dataclass
class OMRResult:
    ok: bool
    error: str = ""
    sbd: str = ""
    exam_code: str = ""
    answers: list[str] = field(default_factory=list)  # "" = bỏ trống, "A", "AC" = tô nhiều
    flags: list[Flag] = field(default_factory=list)
    confidence: float = 0.0
    qr: dict | None = None
    num_questions: int = 0
    num_options: int = 0
    align: AlignResult | None = None
    read: ReadResult | None = None
    warped: np.ndarray | None = None
    elapsed_ms: float = 0.0
    debug: dict[str, np.ndarray] = field(default_factory=dict)

    @property
    def needs_review(self) -> bool:
        return any(f.kind != "warning" for f in self.flags)

    def summary(self) -> dict:
        r = self.read
        return {
            "ok": self.ok,
            "error": self.error,
            "sbd": self.sbd,
            "exam_code": self.exam_code,
            "answers": self.answers,
            "flags": [f.to_dict() for f in self.flags],
            "confidence": round(self.confidence, 4),
            "qr": self.qr,
            "num_questions": self.num_questions,
            "num_options": self.num_options,
            "align_method": self.align.method if self.align else "",
            "rotation": self.align.rotation if self.align else 0,
            "global_threshold": round(r.global_threshold, 2) if r else None,
            "global_jump": round(r.global_jump, 2) if r else None,
            "elapsed_ms": round(self.elapsed_ms, 1),
        }


def decode_qr_from(image: np.ndarray, align_res: AlignResult, ppm: float) -> dict | None:
    det = cv2.QRCodeDetector()
    pad = 3.0
    rect = (L.QR_X - pad, L.QR_Y - pad, L.QR_SIZE + 2 * pad, L.QR_SIZE + 2 * pad)
    tries = []
    if align_res.homography is not None:
        roi = warp_region(image, align_res.homography, ppm, rect, out_ppm=12.0)
        tries += [roi, cv2.threshold(to_gray(roi), 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]]
    for img in tries:
        try:
            text, _, _ = det.detectAndDecode(img)
        except cv2.error:
            text = ""
        info = L.decode_qr(text)
        if info:
            return info
    return None


def _decode_digits(items: list[ItemRead], field_name: str, flags: list[Flag]) -> str:
    out = []
    for i, it in enumerate(items, 1):
        marked = [k for k, m in enumerate(it.marked) if m]
        if len(marked) == 1:
            out.append(it.labels[marked[0]])
            if it.uncertain:
                flags.append(Flag(field_name, "uncertain", f"Chữ số thứ {i} tô không rõ"))
        elif not marked:
            out.append("?")
            flags.append(Flag(field_name, "blank", f"Chữ số thứ {i} chưa được tô"))
        else:
            # nhiều ô: chọn ô đậm nhất nếu vượt trội hẳn, ngược lại không xác định
            vals = sorted((it.values[k], k) for k in marked)
            if vals[1][0] - vals[0][0] > 40:
                out.append(it.labels[vals[0][1]])
                flags.append(Flag(field_name, "uncertain", f"Chữ số thứ {i} có nhiều ô tô, đã chọn ô đậm nhất"))
            else:
                out.append("*")
                flags.append(Flag(field_name, "multiple", f"Chữ số thứ {i} tô nhiều ô"))
    return "".join(out)


def process_image(
    image: np.ndarray,
    num_questions: int | None = None,
    num_options: int | None = None,
    expected_exam_id: int | None = None,
    cfg: ReaderConfig | None = None,
    debug: bool = False,
) -> OMRResult:
    """Chấm một ảnh phiếu.

    num_questions/num_options: cấu hình của kỳ thi (nếu biết). Nếu đọc được mã QR thì
    cấu hình trong QR được ưu tiên vì nó gắn liền với tờ phiếu đã in.
    """
    t0 = time.perf_counter()
    cfg = cfg or ReaderConfig()
    image = to_bgr(image)
    res = OMRResult(ok=False)

    al = align(image, cfg.ppm, debug=debug)
    res.align = al
    if debug:
        res.debug.update(al.debug)
    if not al.ok:
        res.error = al.error
        res.elapsed_ms = (time.perf_counter() - t0) * 1000
        return res
    for w in al.warnings:
        res.flags.append(Flag("sheet", "warning", w))

    res.qr = decode_qr_from(image, al, cfg.ppm)
    nq, no = num_questions, num_options
    if res.qr:
        if expected_exam_id is not None and res.qr["exam_id"] != expected_exam_id:
            res.flags.append(Flag("sheet", "mismatch", f"Phiếu thuộc kỳ thi #{res.qr['exam_id']}, không phải #{expected_exam_id}"))
        if nq is None or res.qr["exam_id"] == expected_exam_id or expected_exam_id is None:
            nq, no = res.qr["num_questions"], res.qr["num_options"]
    if nq is None:
        res.error = "Không đọc được mã QR và chưa biết cấu hình phiếu (số câu)."
        res.elapsed_ms = (time.perf_counter() - t0) * 1000
        return res
    no = no or 4
    sheet = L.build_layout(nq, no)
    res.num_questions, res.num_options = nq, no

    warped = warp(image, al.homography, cfg.ppm)
    res.warped = warped
    rd = read_bubbles(to_gray(warped), sheet, cfg)
    res.read = rd
    if debug:
        res.debug["warped"] = warped
        res.debug["warped_normalized"] = rd.normalized

    by_block: dict[str, list[ItemRead]] = {}
    for it in rd.items:
        by_block.setdefault(it.block, []).append(it)
    res.sbd = _decode_digits(by_block["sbd"], "sbd", res.flags)
    res.exam_code = _decode_digits(by_block["code"], "code", res.flags)

    answers = []
    for it in rd.items:
        if it.block in ("sbd", "code"):
            continue
        v = it.value
        answers.append(v)
        if len(v) > 1:
            res.flags.append(Flag(f"q{it.key}", "multiple", f"Câu {it.key} tô {len(v)} ô ({v})"))
        elif it.uncertain:
            res.flags.append(Flag(f"q{it.key}", "uncertain", f"Câu {it.key} có ô tô mờ hoặc tẩy chưa sạch"))
    res.answers = answers

    if rd.global_jump == 0:
        res.flags.append(Flag("sheet", "warning", "Không phát hiện ô nào được tô rõ ràng — phiếu trống hoặc ảnh quá mờ."))
    n_items = len(rd.items)
    n_unc = sum(1 for it in rd.items if it.uncertain)
    contrast = min(1.0, rd.global_jump / 60.0)
    res.confidence = max(0.0, (1 - n_unc / max(n_items, 1)) * (0.5 + 0.5 * contrast))
    if al.method == "page":
        res.confidence *= 0.7
    res.ok = True
    res.elapsed_ms = (time.perf_counter() - t0) * 1000
    return res


# ---- Chấm điểm ------------------------------------------------------------------

def score_answers(answers: list[str], key: list[str], max_score: float = 10.0) -> dict:
    """So sánh bài làm với đáp án. Câu tô nhiều ô hoặc bỏ trống tính sai."""
    n = len(key)
    detail = []
    correct = 0
    for i in range(n):
        a = answers[i] if i < len(answers) else ""
        k = key[i] if i < len(key) else ""
        ok = bool(k) and a == k
        correct += ok
        detail.append({"q": i + 1, "answer": a, "key": k, "correct": ok})
    score = round(max_score * correct / n, 2) if n else 0.0
    return {"correct": correct, "total": n, "score": score, "detail": detail}


def load_image_bytes(data: bytes) -> list[np.ndarray]:
    """Giải mã ảnh (jpg/png/...) hoặc PDF nhiều trang thành danh sách ảnh BGR."""
    if data[:5] == b"%PDF-":
        import pymupdf

        out = []
        with pymupdf.open(stream=data, filetype="pdf") as doc:
            for page in doc:
                pix = page.get_pixmap(dpi=200)
                arr = np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.width, pix.n)
                out.append(cv2.cvtColor(arr, cv2.COLOR_RGB2BGR if pix.n == 3 else cv2.COLOR_RGBA2BGR))
        return out
    img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Không đọc được file ảnh")
    return [img]
