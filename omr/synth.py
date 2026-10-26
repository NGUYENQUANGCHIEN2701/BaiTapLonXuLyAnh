"""Sinh dữ liệu tổng hợp: phiếu đã tô + mô phỏng ảnh chụp, kèm đáp án thật (ground truth)."""
from __future__ import annotations

import random
from dataclasses import dataclass, field

import cv2
import numpy as np

from . import layout as L
from .sheet_pdf import SheetInfo, render_pdf

RENDER_DPI = 200


@dataclass
class SynthTruth:
    sbd: str
    exam_code: str
    answers: list[str]
    erased: list[int] = field(default_factory=list)   # câu có ô bị tẩy (vết mờ)
    rotation: int = 0

    def to_dict(self) -> dict:
        return {"sbd": self.sbd, "exam_code": self.exam_code, "answers": self.answers,
                "erased": self.erased, "rotation": self.rotation}


def render_blank(exam_id: int, num_questions: int, num_options: int = 4, exam_name: str = "Bài kiểm tra") -> np.ndarray:
    import pymupdf

    sheet = L.build_layout(num_questions, num_options)
    pdf = render_pdf(sheet, [SheetInfo(exam_id, exam_name)])
    with pymupdf.open(stream=pdf, filetype="pdf") as doc:
        pix = doc[0].get_pixmap(dpi=RENDER_DPI)
        arr = np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.width, pix.n)
    return cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)


def _pencil(img: np.ndarray, b: L.Bubble, ppm: float, rng: random.Random, darkness: int, coverage: float = 1.0) -> None:
    """Mô phỏng nét tô bút chì: elip hơi lệch tâm, độ đậm không đều."""
    h, w = img.shape[:2]
    r = b.r * ppm
    cx = b.x * ppm + rng.uniform(-0.12, 0.12) * r
    cy = b.y * ppm + rng.uniform(-0.12, 0.12) * r
    rx, ry = r * rng.uniform(0.82, 1.05) * coverage, r * rng.uniform(0.82, 1.05) * coverage
    x0, y0 = int(cx - r * 1.3), int(cy - r * 1.3)
    x1, y1 = int(cx + r * 1.3) + 1, int(cy + r * 1.3) + 1
    x0, y0, x1, y1 = max(0, x0), max(0, y0), min(w, x1), min(h, y1)
    mask = np.zeros((y1 - y0, x1 - x0), np.float32)
    cv2.ellipse(mask, (int(cx - x0), int(cy - y0)), (int(rx), int(ry)), rng.uniform(0, 180), 0, 360, 1.0, -1, cv2.LINE_AA)
    noise = np.random.default_rng(rng.randrange(1 << 30)).normal(0, 18, mask.shape).astype(np.float32)
    tone = np.clip(darkness + noise, 0, 255)
    roi = img[y0:y1, x0:x1].astype(np.float32)
    for ch in range(3):
        roi[..., ch] = roi[..., ch] * (1 - mask) + np.minimum(roi[..., ch], tone) * mask
    img[y0:y1, x0:x1] = roi.astype(np.uint8)


def fill_sheet(
    blank: np.ndarray,
    num_questions: int,
    num_options: int = 4,
    seed: int = 0,
    sbd: str | None = None,
    exam_code: str | None = None,
    p_blank: float = 0.04,
    p_multi: float = 0.03,
    p_erased: float = 0.05,
) -> tuple[np.ndarray, SynthTruth]:
    rng = random.Random(seed)
    sheet = L.build_layout(num_questions, num_options)
    ppm = blank.shape[1] / L.PAGE_W
    img = blank.copy()
    sbd = sbd or "".join(rng.choice("0123456789") for _ in range(L.SBD_LEN))
    exam_code = exam_code or "".join(rng.choice("0123456789") for _ in range(L.CODE_LEN))
    darkness = rng.randint(25, 85)  # mỗi thí sinh một độ đậm bút khác nhau

    for block, value in ((sheet.sbd, sbd), (sheet.code, exam_code)):
        for col, d in zip(block.items, value):
            _pencil(img, col[int(d)], ppm, rng, darkness + rng.randint(-10, 10))

    answers, erased = [], []
    for qi, row in enumerate(sheet.question_bubbles()):
        u = rng.random()
        if u < p_blank:
            answers.append("")
            continue
        if u < p_blank + p_multi:
            picks = sorted(rng.sample(range(num_options), 2))
        else:
            picks = [rng.randrange(num_options)]
        if rng.random() < p_erased:
            others = [k for k in range(num_options) if k not in picks]
            k = rng.choice(others)
            # vết tẩy: nhạt và loang
            _pencil(img, row[k], ppm, rng, rng.randint(185, 215), coverage=rng.uniform(0.7, 1.0))
            erased.append(qi + 1)
        for k in picks:
            _pencil(img, row[k], ppm, rng, darkness + rng.randint(-10, 15))
        answers.append("".join(L.OPTION_LABELS[k] for k in picks))
    return img, SynthTruth(sbd, exam_code, answers, erased)


def photograph(sheet_img: np.ndarray, seed: int = 0, strength: float = 1.0, allow_rotation: bool = True) -> tuple[np.ndarray, int]:
    """Mô phỏng ảnh chụp điện thoại: đặt lên nền, phối cảnh, xoay, bóng đổ, nhiễu, mờ, nén JPEG."""
    rng = np.random.default_rng(seed)
    h, w = sheet_img.shape[:2]
    out_w, out_h = int(w * 1.25), int(h * 1.18)
    bg_color = rng.integers(60, 200, size=3).astype(np.float32)
    bg = np.ones((out_h, out_w, 3), np.float32) * bg_color
    bg += rng.normal(0, 12, bg.shape).astype(np.float32)
    bg = cv2.GaussianBlur(bg, (0, 0), 3)

    j = 0.06 * strength
    ox, oy = (out_w - w) / 2, (out_h - h) / 2
    src = np.float32([[0, 0], [w, 0], [w, h], [0, h]])
    dst = np.float32([
        [ox + rng.uniform(-j, j) * w, oy + rng.uniform(-j, j) * h],
        [ox + w + rng.uniform(-j, j) * w, oy + rng.uniform(-j, j) * h],
        [ox + w + rng.uniform(-j, j) * w, oy + h + rng.uniform(-j, j) * h],
        [ox + rng.uniform(-j, j) * w, oy + h + rng.uniform(-j, j) * h],
    ])
    M = cv2.getPerspectiveTransform(src, dst)
    paper = cv2.warpPerspective(sheet_img.astype(np.float32), M, (out_w, out_h), flags=cv2.INTER_LINEAR)
    mask = cv2.warpPerspective(np.ones((h, w), np.float32), M, (out_w, out_h))[..., None]
    img = bg * (1 - mask) + paper * mask

    # ánh sáng không đều + bóng đổ
    yy, xx = np.mgrid[0:out_h, 0:out_w].astype(np.float32)
    gx, gy = rng.uniform(-1, 1, 2)
    grad = 1 - 0.25 * strength * ((xx / out_w - 0.5) * gx + (yy / out_h - 0.5) * gy + 0.5) * rng.uniform(0.3, 1)
    img *= grad[..., None]
    if rng.random() < 0.6 * strength:
        cx, cy = rng.uniform(0, out_w), rng.uniform(0, out_h)
        rad = rng.uniform(0.2, 0.5) * out_w
        shadow = np.exp(-(((xx - cx) ** 2 + (yy - cy) ** 2) / (2 * rad * rad)))
        img *= (1 - rng.uniform(0.2, 0.45) * strength * shadow)[..., None]
    img += rng.normal(0, 4 + 4 * strength, img.shape).astype(np.float32)
    img = np.clip(img, 0, 255).astype(np.uint8)
    sigma = rng.uniform(0.3, 1.0 + strength)
    img = cv2.GaussianBlur(img, (0, 0), sigma)

    rotation = 0
    if allow_rotation and rng.random() < 0.3:
        rotation = int(rng.choice([90, 180, 270]))
        img = np.ascontiguousarray(np.rot90(img, k=-rotation // 90))
    scale = rng.uniform(0.55, 0.9)
    img = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    ok, enc = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, int(rng.integers(55, 92))])
    return cv2.imdecode(enc, cv2.IMREAD_COLOR), rotation
