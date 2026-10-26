"""Vẽ kết quả lên ảnh để người chấm kiểm tra / phúc tra."""
from __future__ import annotations

from typing import Sequence

import cv2
import numpy as np

from .alignment import AlignResult
from .preprocess import to_bgr
from .reader import ItemRead

GREEN = (60, 170, 40)
RED = (40, 40, 220)
BLUE = (200, 120, 20)
ORANGE = (0, 150, 255)
GRAY = (150, 150, 150)


def _circle(img, center, r, color, filled):
    c = (int(round(center[0])), int(round(center[1])))
    if filled:
        cv2.circle(img, c, int(r), color, -1, cv2.LINE_AA)
    else:
        cv2.circle(img, c, int(r) + 1, color, 2, cv2.LINE_AA)


def annotate(
    warped: np.ndarray,
    items: Sequence[ItemRead],
    key: list[str] | None = None,
    answers: list[str] | None = None,
) -> np.ndarray:
    """Ảnh phiếu đã nắn với: ô tô đúng (xanh lá), sai (đỏ), đáp án đúng bị bỏ lỡ (viền xanh),
    câu cần xem lại (khung cam), SBD/mã đề (xanh dương).

    `answers`: đáp án cuối cùng (sau khi người chấm sửa tay); mặc định lấy theo kết quả OMR.
    """
    img = to_bgr(warped.copy())
    layer = img.copy()
    qi = 0
    for it in items:
        if it.block in ("sbd", "code"):
            for c, m in zip(it.centers, it.marked):
                if m:
                    _circle(layer, c, it.radius, BLUE, True)
            continue
        ans = answers[qi] if answers is not None and qi < len(answers) else it.value
        k = key[qi] if key and qi < len(key) else None
        qi += 1
        for lb, c in zip(it.labels, it.centers):
            chosen = lb in ans
            if chosen:
                color = GRAY if not k else (GREEN if ans == k else RED)
                _circle(layer, c, it.radius, color, True)
            if k and lb in k and ans != k:
                _circle(img, c, it.radius + 1, GREEN, False)
        if (it.uncertain or len(ans) > 1) and (answers is None or ans != (k or "")):
            x0 = int(min(c[0] for c in it.centers) - it.radius * 2.6)
            x1 = int(max(c[0] for c in it.centers) + it.radius * 1.6)
            y = it.centers[0][1]
            cv2.rectangle(img, (x0, int(y - it.radius * 1.4)), (x1, int(y + it.radius * 1.4)), ORANGE, 2)
    return cv2.addWeighted(layer, 0.55, img, 0.45, 0)


def draw_detection(image: np.ndarray, al: AlignResult, max_side: int = 1600) -> np.ndarray:
    """Ảnh gốc + các ứng viên marker (vàng) + 4 marker được chọn (xanh) + khung phiếu."""
    img = to_bgr(image.copy())
    big = max(img.shape[:2])
    scale = 1.0 / min(1.0, max_side / big)  # ứng viên được tìm trên ảnh đã thu nhỏ
    th = max(2, int(3 * big / 1600))
    for c in al.candidates[:60]:
        cnt = (c.contour.astype(np.float64) * scale).astype(np.int32)
        cv2.drawContours(img, [cnt], -1, (0, 200, 255), th)
    if al.page_quad is not None:
        cv2.polylines(img, [al.page_quad.astype(np.int32)], True, BLUE, th, cv2.LINE_AA)
    if al.markers:
        pts = np.array(al.markers, dtype=np.int32)
        cv2.polylines(img, [pts], True, GREEN, th * 2, cv2.LINE_AA)
        for i, (name, p) in enumerate(zip(("TL", "TR", "BR", "BL"), pts)):
            cv2.circle(img, tuple(int(v) for v in p), th * 5, RED if i == 0 else GREEN, -1)
            cv2.putText(img, name, (int(p[0]) + th * 6, int(p[1]) - th * 3),
                        cv2.FONT_HERSHEY_SIMPLEX, 1.2 * big / 1600, RED, th)
    return img
