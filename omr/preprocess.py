"""Các bước tiền xử lý ảnh dùng chung."""
from __future__ import annotations

import cv2
import numpy as np


def to_gray(img: np.ndarray) -> np.ndarray:
    if img.ndim == 2:
        return img
    if img.shape[2] == 4:
        return cv2.cvtColor(img, cv2.COLOR_BGRA2GRAY)
    return cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)


def to_bgr(img: np.ndarray) -> np.ndarray:
    if img.ndim == 2:
        return cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    if img.shape[2] == 4:
        return cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)
    return img


def limit_size(img: np.ndarray, max_side: int) -> tuple[np.ndarray, float]:
    """Thu nhỏ ảnh để cạnh dài nhất <= max_side. Trả về (ảnh, hệ số đã nhân)."""
    h, w = img.shape[:2]
    s = max_side / max(h, w)
    if s >= 1:
        return img, 1.0
    return cv2.resize(img, (round(w * s), round(h * s)), interpolation=cv2.INTER_AREA), s


def _odd(n: int) -> int:
    return n if n % 2 else n + 1


def estimate_background(gray: np.ndarray, kernel_frac: float = 0.06) -> np.ndarray:
    """Ước lượng nền giấy (độ sáng khi không có mực) bằng phép đóng hình thái học.

    Phép đóng (giãn rồi co) với phần tử cấu trúc lớn hơn mọi nét mực sẽ "xóa" chữ, ô tô,
    marker... chỉ còn lại sự biến thiên chậm của ánh sáng (bóng đổ, vùng tối ở rìa).
    Làm trên ảnh thu nhỏ 4 lần cho nhanh rồi phóng ngược lại.
    """
    h, w = gray.shape
    small = cv2.resize(gray, (max(1, w // 4), max(1, h // 4)), interpolation=cv2.INTER_AREA)
    k = _odd(max(5, int(min(small.shape) * kernel_frac)))
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))
    bg = cv2.morphologyEx(small, cv2.MORPH_CLOSE, kernel)
    bg = cv2.GaussianBlur(bg, (0, 0), k / 2)
    return cv2.resize(bg, (w, h), interpolation=cv2.INTER_LINEAR)


def normalize_illumination(gray: np.ndarray, kernel_frac: float = 0.06) -> np.ndarray:
    """Chuẩn hóa độ sáng: chia ảnh cho nền -> giấy trắng ~255 ở mọi vùng, loại bỏ bóng đổ."""
    bg = estimate_background(gray, kernel_frac)
    norm = cv2.divide(gray.astype(np.float32), np.maximum(bg.astype(np.float32), 1.0), scale=255.0)
    return np.clip(norm, 0, 255).astype(np.uint8)


def binarize_dark(norm: np.ndarray, lo: int = 60, hi: int = 150) -> tuple[np.ndarray, float]:
    """Nhị phân hóa (mực = 255) bằng Otsu, ngưỡng bị kẹp trong [lo, hi] để ổn định."""
    blur = cv2.GaussianBlur(norm, (3, 3), 0)
    t, _ = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    t = float(np.clip(t, lo, hi))
    _, binary = cv2.threshold(blur, t, 255, cv2.THRESH_BINARY_INV)
    return binary, t
