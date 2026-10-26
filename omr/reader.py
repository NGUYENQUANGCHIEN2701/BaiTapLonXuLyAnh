"""Đọc các ô tròn trên ảnh phiếu đã được nắn về hệ tọa độ chuẩn.

Quy trình:
1. Chuẩn hóa độ sáng (loại bóng đổ) -> giấy trắng ~255.
2. Căn chỉnh tinh từng khối (cột câu hỏi, SBD, mã đề) bằng template matching với hình
   vẽ lý thuyết của khối — bù lại sai lệch do giấy cong/nhăn mà homography 4 điểm
   không mô hình hóa được.
3. Đo độ sáng trung bình trong lõi mỗi ô tròn.
4. Tìm ngưỡng toàn cục bằng "bước nhảy lớn nhất" trên dãy giá trị đã sắp xếp
   (ý tưởng từ OMRChecker: get_global_threshold), sau đó tinh chỉnh ngưỡng cục bộ cho
   từng câu nhưng giới hạn trong một dải quanh ngưỡng toàn cục.
5. Gắn cờ những câu không chắc chắn (giá trị nằm sát ngưỡng), tô nhiều ô, bỏ trống.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import cv2
import numpy as np

from . import layout as L
from .preprocess import normalize_illumination


@dataclass
class ReaderConfig:
    ppm: float = 6.0
    core_ratio: float = 0.62        # bán kính vùng đo / bán kính ô (bỏ qua viền in)
    min_jump: float = 25.0          # bước nhảy tối thiểu để coi là có ô được tô (OMRChecker: MIN_JUMP)
    confident_surplus: float = 5.0  # OMRChecker: CONFIDENT_SURPLUS
    default_threshold: float = 175.0
    local_band: float = 0.22        # ngưỡng cục bộ chỉ được lệch tối đa band*jump khỏi ngưỡng toàn cục
    uncertain_band: float = 0.14    # |giá trị - ngưỡng| < band*jump -> không chắc chắn
    faint_ratio: float = 0.35       # ô trống tối hơn mức "ô trống điển hình" quá tỉ lệ này -> vết tẩy/tô mờ
    align_margin_mm: float = 2.5    # phạm vi tìm dịch chuyển của mỗi khối
    align_min_score: float = 0.25


@dataclass
class ItemRead:
    block: str
    key: str                 # số câu ("1", "2"...) hoặc "sbd1"...
    labels: list[str]
    values: list[float]      # độ sáng trung bình (0 đen .. 255 trắng)
    centers: list[tuple[float, float]]  # tâm ô (px trên ảnh chuẩn) sau căn chỉnh
    radius: float
    threshold: float
    marked: list[bool]
    uncertain: bool

    @property
    def value(self) -> str:
        return "".join(lb for lb, m in zip(self.labels, self.marked) if m)


@dataclass
class ReadResult:
    items: list[ItemRead]
    global_threshold: float
    global_jump: float
    block_shifts: dict[str, tuple[float, float, float]] = field(default_factory=dict)  # dx, dy (px), score
    normalized: np.ndarray | None = None


def find_jump_threshold(values, min_jump: float, default: float, looseness: int = 1) -> tuple[float, float]:
    """Tìm "khoảng trống" lớn nhất trong dãy giá trị đã sắp xếp và đặt ngưỡng ở giữa.

    Ô được tô (tối) và ô trống (sáng) tạo thành 2 cụm; khoảng nhảy lớn nhất giữa hai
    giá trị liền kề (nới lỏng `looseness` phần tử để chịu nhiễu) chính là ranh giới.
    """
    q = np.sort(np.asarray(values, dtype=np.float64))
    step = max(1, 2 * ((looseness + 1) // 2))  # looseness=1 -> so q[i+2] với q[i] như OMRChecker
    best_jump, thr, found = min_jump, default, False
    for i in range(len(q) - step):
        jump = q[i + step] - q[i]
        if jump > best_jump:
            best_jump, thr, found = jump, q[i] + jump / 2, True
    if not found:
        return default, 0.0
    return float(thr), float(best_jump)


def _render_block_template(block: L.FieldBlock, ppm: float, pad: int) -> tuple[np.ndarray, tuple[int, int]]:
    """Vẽ "khung lý thuyết" của khối (viền khung + vòng tròn các ô) để so khớp mẫu."""
    b = block.box
    x0, y0 = int(b.x * ppm) - pad, int(b.y * ppm) - pad
    w, h = int(b.w * ppm) + 2 * pad, int(b.h * ppm) + 2 * pad
    tpl = np.zeros((h, w), np.uint8)
    t = max(1, round(ppm * 0.25))
    cv2.rectangle(tpl, (int(b.x * ppm) - x0, int(b.y * ppm) - y0),
                  (int((b.x + b.w) * ppm) - x0, int((b.y + b.h) * ppm) - y0), 255, t)
    for row in block.items:
        for bb in row:
            cv2.circle(tpl, (round(bb.x * ppm) - x0, round(bb.y * ppm) - y0), round(bb.r * ppm), 255, t)
    return cv2.GaussianBlur(tpl, (0, 0), ppm * 0.25), (x0, y0)


def align_block(ink: np.ndarray, block: L.FieldBlock, cfg: ReaderConfig) -> tuple[float, float, float]:
    """Tìm dịch chuyển (dx, dy) tốt nhất của khối trong phạm vi ±align_margin_mm."""
    ppm = cfg.ppm
    m = round(cfg.align_margin_mm * ppm)
    tpl, (tx, ty) = _render_block_template(block, ppm, pad=2)
    th, tw = tpl.shape
    H, W = ink.shape
    sx0, sy0 = max(0, tx - m), max(0, ty - m)
    sx1, sy1 = min(W, tx + tw + m), min(H, ty + th + m)
    search = ink[sy0:sy1, sx0:sx1]
    if search.shape[0] < th or search.shape[1] < tw:
        return 0.0, 0.0, 0.0
    res = cv2.matchTemplate(search, tpl, cv2.TM_CCOEFF_NORMED)
    _, score, _, loc = cv2.minMaxLoc(res)
    dx, dy = loc[0] + sx0 - tx, loc[1] + sy0 - ty
    if score < cfg.align_min_score:
        return 0.0, 0.0, float(score)
    return float(dx), float(dy), float(score)


def _disk_mask(radius_px: float) -> tuple[np.ndarray, int]:
    r = int(np.ceil(radius_px))
    yy, xx = np.mgrid[-r : r + 1, -r : r + 1]
    return (xx * xx + yy * yy) <= radius_px * radius_px, r


def _mean_in_disk(img: np.ndarray, cx: float, cy: float, mask: np.ndarray, r: int) -> float:
    x, y = int(round(cx)), int(round(cy))
    H, W = img.shape
    if x - r < 0 or y - r < 0 or x + r + 1 > W or y + r + 1 > H:
        return 255.0
    patch = img[y - r : y + r + 1, x - r : x + r + 1]
    return float(patch[mask].mean())


def read_bubbles(warped_gray: np.ndarray, sheet: L.SheetLayout, cfg: ReaderConfig | None = None) -> ReadResult:
    cfg = cfg or ReaderConfig()
    ppm = cfg.ppm
    norm = normalize_illumination(warped_gray, kernel_frac=0.04)
    # ảnh "mực" cho template matching: viền in và nét tô có giá trị cao
    ink = cv2.GaussianBlur(255 - norm, (0, 0), ppm * 0.2)

    raw: list[tuple[L.FieldBlock, int, list[float], list[tuple[float, float]], float]] = []
    shifts: dict[str, tuple[float, float, float]] = {}
    for block in sheet.blocks:
        dx, dy, score = align_block(ink, block, cfg)
        shifts[block.name] = (dx, dy, score)
        for idx, row in enumerate(block.items):
            r_px = row[0].r * ppm * cfg.core_ratio
            mask, rr = _disk_mask(r_px)
            centers = [(b.x * ppm + dx, b.y * ppm + dy) for b in row]
            vals = [_mean_in_disk(norm, cx, cy, mask, rr) for cx, cy in centers]
            raw.append((block, idx, vals, centers, row[0].r * ppm))

    all_vals = [v for _, _, vals, _, _ in raw for v in vals]
    g_thr, g_jump = find_jump_threshold(all_vals, cfg.min_jump, cfg.default_threshold)
    jump_ref = g_jump if g_jump > 0 else 80.0
    band = cfg.local_band * jump_ref
    unc = max(6.0, cfg.uncertain_band * jump_ref)
    confident_jump = cfg.min_jump + cfg.confident_surplus
    # mức sáng điển hình của ô trống (đã gồm chữ cái in mờ trong ô)
    empties = [v for v in all_vals if v >= g_thr]
    empty_level = float(np.median(empties)) if empties else 255.0
    faint_cut = empty_level - cfg.faint_ratio * max(empty_level - g_thr, 20.0)

    items: list[ItemRead] = []
    for block, idx, vals, centers, r_px in raw:
        l_thr, l_jump = find_jump_threshold(vals, confident_jump, g_thr, looseness=0)
        thr = float(np.clip(l_thr if l_jump > 0 else g_thr, g_thr - band, g_thr + band))
        marked = [v < thr for v in vals]
        uncertain = any(abs(v - thr) < unc for v in vals) or any(not m and v < faint_cut for v, m in zip(vals, marked))
        labels = [b.label for b in block.items[idx]]
        items.append(ItemRead(block.name, block.item_keys[idx], labels, vals, centers, r_px, thr, marked, uncertain))

    return ReadResult(items, g_thr, g_jump, shifts, norm)
