"""Định vị phiếu trong ảnh và nắn phối cảnh về hệ tọa độ chuẩn.

Chiến lược (theo thứ tự ưu tiên):
1. Tìm 4 marker vuông ở góc phiếu -> homography 4 điểm.
2. Nếu thất bại: tìm khung tờ giấy (Canny + contour), nắn sơ bộ, rồi tìm marker lần nữa.
3. Nếu vẫn thất bại: dùng trực tiếp 4 góc tờ giấy (kém chính xác hơn, gắn cờ cảnh báo).

Marker góc trên-trái có lỗ trắng ở giữa nên ta biết được chiều của phiếu, kể cả khi
ảnh bị xoay 90/180/270 độ.
"""
from __future__ import annotations

import itertools
import math
from dataclasses import dataclass, field

import cv2
import numpy as np

from . import layout as L
from .preprocess import binarize_dark, limit_size, normalize_illumination, to_gray

DETECT_MAX_SIDE = 1600
MARKER_SPAN_W = L.MARKER_CENTERS[1][0] - L.MARKER_CENTERS[0][0]  # 188 mm
MARKER_SPAN_H = L.MARKER_CENTERS[3][1] - L.MARKER_CENTERS[0][1]  # 275 mm
SPAN_RATIO = MARKER_SPAN_W / MARKER_SPAN_H


@dataclass
class MarkerCandidate:
    center: tuple[float, float]
    area: float
    side: float
    ink_center: float  # tỉ lệ điểm mực ở tâm: ~1 với marker đặc, ~0 với marker rỗng
    contour: np.ndarray


@dataclass
class AlignResult:
    ok: bool
    method: str = ""
    homography: np.ndarray | None = None  # ảnh gốc -> canvas (px theo ppm)
    markers: list[tuple[float, float]] = field(default_factory=list)  # TL, TR, BR, BL (ảnh gốc)
    candidates: list[MarkerCandidate] = field(default_factory=list)
    page_quad: np.ndarray | None = None
    rotation: int = 0  # góc xoay của phiếu trong ảnh (0/90/180/270)
    verify_score: float = 0.0  # độ khớp với hình mẫu phiếu sau khi nắn (0..1)
    warnings: list[str] = field(default_factory=list)
    debug: dict[str, np.ndarray] = field(default_factory=dict)
    error: str = ""


def canvas_size(ppm: float) -> tuple[int, int]:
    return round(L.PAGE_W * ppm), round(L.PAGE_H * ppm)


def _order_clockwise(pts: np.ndarray) -> np.ndarray:
    c = pts.mean(axis=0)
    ang = np.arctan2(pts[:, 1] - c[1], pts[:, 0] - c[0])
    return pts[np.argsort(ang)]  # trục y hướng xuống -> tăng dần = chiều kim đồng hồ


def find_marker_candidates(binary: np.ndarray) -> list[MarkerCandidate]:
    h, w = binary.shape
    img_area = h * w
    min_area = max(40.0, img_area * 4e-5)
    max_area = img_area * 0.02
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    out: list[MarkerCandidate] = []
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if not min_area <= area <= max_area:
            continue
        (_, _), (rw, rh), _ = cv2.minAreaRect(cnt)
        if min(rw, rh) / max(rw, rh, 1e-6) < 0.6:
            continue
        if area / max(cv2.contourArea(cv2.convexHull(cnt)), 1e-6) < 0.9:
            continue
        # Phân biệt vuông / tròn: xấp xỉ contour bằng đa giác 4 đỉnh rồi so diện tích.
        # Hình vuông (kể cả bị phối cảnh) -> tỉ số ~1; hình tròn -> ~0.64 (2r² / πr²).
        approx = cv2.approxPolyDP(cnt, 0.05 * cv2.arcLength(cnt, True), True)
        if len(approx) != 4 or cv2.contourArea(approx) / area < 0.86:
            continue
        side = math.sqrt(area)
        m = cv2.moments(cnt)
        if m["m00"] <= 0:
            continue
        cx, cy = m["m10"] / m["m00"], m["m01"] / m["m00"]
        rr = max(1, int(side * 0.16))
        x0, y0 = int(round(cx)) - rr, int(round(cy)) - rr
        patch = binary[max(0, y0) : y0 + 2 * rr + 1, max(0, x0) : x0 + 2 * rr + 1]
        ink = float(patch.mean() / 255.0) if patch.size else 1.0
        out.append(MarkerCandidate((cx, cy), area, side, ink, cnt))
    out.sort(key=lambda c: c.area, reverse=True)
    return out


def marker_quads(cands: list[MarkerCandidate], limit: int = 18, keep: int = 8) -> list[list[MarkerCandidate]]:
    """Liệt kê các bộ 4 ứng viên có hình học hợp lý (theo chiều kim đồng hồ),
    sắp theo diện tích tứ giác giảm dần — marker thật nằm ngoài cùng nên diện tích lớn nhất."""
    pool = cands[:limit]
    found: list[tuple[float, list[MarkerCandidate]]] = []
    for combo in itertools.combinations(range(len(pool)), 4):
        cs = [pool[i] for i in combo]
        sides = np.array([c.side for c in cs])
        if sides.min() / sides.max() < 0.55:
            continue
        pts = np.array([c.center for c in cs], dtype=np.float64)
        order = np.argsort(np.arctan2(pts[:, 1] - pts[:, 1].mean(), pts[:, 0] - pts[:, 0].mean()))
        pts, cs = pts[order], [cs[i] for i in order]
        quad = pts.astype(np.float32)
        if not cv2.isContourConvex(quad.reshape(-1, 1, 2)):
            continue
        e = [np.linalg.norm(pts[(i + 1) % 4] - pts[i]) for i in range(4)]
        if min(e[0], e[2]) / max(e[0], e[2]) < 0.6 or min(e[1], e[3]) / max(e[1], e[3]) < 0.6:
            continue
        r = (e[0] + e[2]) / (e[1] + e[3])
        if not (SPAN_RATIO / 1.3 < r < SPAN_RATIO * 1.3 or SPAN_RATIO / 1.3 < 1 / r < SPAN_RATIO * 1.3):
            continue
        short = min(e[0] + e[2], e[1] + e[3]) / 2
        rel = sides.mean() / short  # marker 8mm / 188mm ~ 0.043
        if not 0.022 < rel < 0.075:
            continue
        found.append((cv2.contourArea(quad), cs))
    found.sort(key=lambda t: t[0], reverse=True)
    return [cs for _, cs in found[:keep]]


VERIFY_PPM = 3.0
_verify_tpl: np.ndarray | None = None


def _verify_template() -> np.ndarray:
    """Ảnh "mực" lý thuyết của các phần CỐ ĐỊNH trên mọi phiếu (không phụ thuộc số câu)."""
    global _verify_tpl
    if _verify_tpl is None:
        ppm = VERIFY_PPM
        cw, ch = canvas_size(ppm)
        tpl = np.zeros((ch, cw), np.uint8)
        P = lambda x, y: (round(x * ppm), round(y * ppm))  # noqa: E731
        for i, (cx, cy) in enumerate(L.MARKER_CENTERS):
            s = L.MARKER_SIZE / 2
            cv2.rectangle(tpl, P(cx - s, cy - s), P(cx + s, cy + s), 255, -1)
            if i == 0:
                hh = L.MARKER_HOLE / 2
                cv2.rectangle(tpl, P(cx - hh, cy - hh), P(cx + hh, cy + hh), 0, -1)
        sheet = L.build_layout(1, 4)
        for block in (sheet.sbd, sheet.code):
            b = block.box
            cv2.rectangle(tpl, P(b.x, b.y), P(b.x + b.w, b.y + b.h), 255, 1)
            for col in block.items:
                for bb in col:
                    cv2.circle(tpl, P(bb.x, bb.y), round(bb.r * ppm), 255, 1)
        cv2.rectangle(tpl, P(L.CONTENT_X0, 33.0), P(104.0, 104.0), 255, 1)
        _verify_tpl = cv2.GaussianBlur(tpl, (0, 0), 1.0)
    return _verify_tpl


def verify_score(norm: np.ndarray, markers: np.ndarray) -> float:
    """Nắn thử ảnh theo 4 điểm marker rồi đo độ tương quan với hình mẫu -> càng cao càng đúng."""
    dst = np.array(L.MARKER_CENTERS, dtype=np.float32) * VERIFY_PPM
    return verify_homography(norm, cv2.getPerspectiveTransform(markers.astype(np.float32), dst))


def verify_homography(norm: np.ndarray, H: np.ndarray) -> float:
    tpl = _verify_template()
    cw, ch = canvas_size(VERIFY_PPM)
    w = cv2.warpPerspective(norm, H, (cw, ch), flags=cv2.INTER_AREA, borderValue=255)
    ink = cv2.GaussianBlur(255 - w, (0, 0), 1.0)
    return float(cv2.matchTemplate(ink, tpl, cv2.TM_CCOEFF_NORMED)[0, 0])


def select_markers(cands: list[MarkerCandidate], norm: np.ndarray, min_score: float = 0.3):
    """Chọn bộ marker + chiều phiếu tốt nhất bằng kiểm chứng hình mẫu.

    Thử mỗi bộ 4 điểm hợp lệ với cả 4 cách xoay vòng (TL có thể là bất kỳ góc nào).
    Trả về (marker theo thứ tự TL, TR, BR, BL của PHIẾU, góc xoay, điểm kiểm chứng) hoặc None.
    """
    best = None
    for cs in marker_quads(cands):
        pts = np.array([c.center for c in cs], dtype=np.float32)
        e = [np.linalg.norm(pts[(i + 1) % 4] - pts[i]) for i in range(4)]
        # cạnh TL->TR là chiều rộng phiếu (cạnh ngắn) -> chỉ còn 2 khả năng xoay
        starts = [0, 2] if e[0] + e[2] <= e[1] + e[3] else [1, 3]
        for k in starts:
            sc = verify_score(norm, np.roll(pts, -k, axis=0))
            if best is None or sc > best[2]:
                best = (cs[k:] + cs[:k], k, sc)
        if best and best[2] > 0.6:  # khớp rất tốt -> không cần thử tiếp
            break
    if best is None or best[2] < min_score:
        return None
    ms, _, sc = best
    v = np.subtract(ms[1].center, ms[0].center)
    rotation = int(round(math.degrees(math.atan2(v[1], v[0])) / 90.0)) % 4 * 90
    return ms, rotation, sc


def find_page_quad(gray: np.ndarray) -> np.ndarray | None:
    """Tìm tứ giác lớn nhất (tờ giấy) bằng Canny + contour + xấp xỉ đa giác."""
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blur, 40, 120)
    edges = cv2.dilate(edges, cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5)))
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    img_area = gray.shape[0] * gray.shape[1]
    for cnt in sorted(contours, key=cv2.contourArea, reverse=True)[:5]:
        if cv2.contourArea(cnt) < 0.2 * img_area:
            break
        hull = cv2.convexHull(cnt)
        approx = cv2.approxPolyDP(hull, 0.02 * cv2.arcLength(hull, True), True)
        if len(approx) == 4:
            pts = _order_clockwise(approx.reshape(4, 2).astype(np.float32))
            # TL = góc gần gốc ảnh nhất, và cạnh trên là cạnh ngắn (giấy dọc)
            k = int(np.argmin(pts.sum(axis=1)))
            pts = np.roll(pts, -k, axis=0)
            if np.linalg.norm(pts[1] - pts[0]) > np.linalg.norm(pts[2] - pts[1]):
                pts = np.roll(pts, -1, axis=0)
            return pts
    return None


def _marker_homography(markers: list[tuple[float, float]], ppm: float) -> np.ndarray:
    src = np.array(markers, dtype=np.float32)
    dst = np.array(L.MARKER_CENTERS, dtype=np.float32) * ppm
    return cv2.getPerspectiveTransform(src, dst)


def _detect_markers_on(gray: np.ndarray) -> tuple[list[MarkerCandidate], tuple | None, dict]:
    norm = normalize_illumination(gray)
    binary, _ = binarize_dark(norm)
    binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
    cands = find_marker_candidates(binary)
    return cands, select_markers(cands, norm), {"normalized": norm, "binary": binary}


def align(image: np.ndarray, ppm: float, debug: bool = False) -> AlignResult:
    gray_full = to_gray(image)
    gray, s = limit_size(gray_full, DETECT_MAX_SIDE)
    res = AlignResult(ok=False)

    cands, sel, dbg = _detect_markers_on(gray)
    if debug:
        res.debug.update({f"detect_{k}": v for k, v in dbg.items()})
    res.candidates = cands
    if sel is not None:
        ms, rot, sc = sel
        res.markers = [(c.center[0] / s, c.center[1] / s) for c in ms]
        res.homography = _marker_homography(res.markers, ppm)
        res.method, res.ok, res.rotation, res.verify_score = "markers", True, rot, sc
        return res

    # --- Phương án dự phòng: tìm khung tờ giấy ---
    quad = find_page_quad(gray)
    if quad is None:
        res.error = "Không tìm thấy 4 marker góc và cũng không tìm thấy khung tờ giấy."
        return res
    norm = dbg["normalized"]
    cw, ch = canvas_size(ppm)
    page_dst = np.array([[0, 0], [cw, 0], [cw, ch], [0, ch]], dtype=np.float32)
    # chưa biết chiều tờ giấy -> thử 4 cách xoay, chọn cách khớp hình mẫu nhất
    best = None
    for k in range(4):
        q = np.roll(quad, -k, axis=0)
        h_v = cv2.getPerspectiveTransform(q.astype(np.float32), page_dst * (VERIFY_PPM / ppm))
        sc = verify_homography(norm, h_v)
        if best is None or sc > best[1]:
            best = (q, sc, k)
    quad, sc, k = best
    quad = quad / s
    res.page_quad = quad
    h_page = cv2.getPerspectiveTransform(quad.astype(np.float32), page_dst)
    warped = cv2.warpPerspective(gray_full, h_page, (cw, ch), flags=cv2.INTER_LINEAR, borderValue=255)
    cands2, sel2, _ = _detect_markers_on(warped)
    if sel2 is not None:
        ms, _, sc2 = sel2
        pts_w = np.array([c.center for c in ms], dtype=np.float32).reshape(-1, 1, 2)
        pts_img = cv2.perspectiveTransform(pts_w, np.linalg.inv(h_page)).reshape(-1, 2)
        res.markers = [tuple(map(float, p)) for p in pts_img]
        res.homography = _marker_homography(res.markers, ppm)
        res.method, res.ok, res.verify_score = "page+markers", True, sc2
    else:
        res.homography = h_page
        res.method, res.ok, res.verify_score = "page", True, sc
        res.warnings.append("Chỉ căn chỉnh theo mép giấy (không thấy marker) — độ chính xác có thể giảm.")
    v = quad[1] - quad[0]
    res.rotation = int(round(math.degrees(math.atan2(v[1], v[0])) / 90.0)) % 4 * 90
    if res.verify_score < 0.3:
        res.ok = False
        res.error = "Ảnh không giống phiếu trả lời của hệ thống (kiểm chứng thất bại)."
    return res


def warp(image: np.ndarray, homography: np.ndarray, ppm: float) -> np.ndarray:
    cw, ch = canvas_size(ppm)
    return cv2.warpPerspective(image, homography, (cw, ch), flags=cv2.INTER_LINEAR, borderValue=(255, 255, 255))


def warp_region(image: np.ndarray, homography: np.ndarray, ppm: float, rect_mm: tuple, out_ppm: float) -> np.ndarray:
    """Nắn riêng một vùng (tính bằng mm) ở độ phân giải cao hơn, ví dụ vùng mã QR."""
    x, y, w, h = rect_mm
    scale = out_ppm / ppm
    t = np.array([[scale, 0, -x * out_ppm], [0, scale, -y * out_ppm], [0, 0, 1]], dtype=np.float64)
    return cv2.warpPerspective(
        image, t @ homography, (round(w * out_ppm), round(h * out_ppm)), flags=cv2.INTER_CUBIC, borderValue=(255, 255, 255)
    )
