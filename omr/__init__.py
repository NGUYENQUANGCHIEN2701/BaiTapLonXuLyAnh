"""Lõi xử lý ảnh chấm phiếu trắc nghiệm (OMR)."""
from .layout import build_layout, encode_qr, decode_qr
from .pipeline import OMRResult, process_image, score_answers, load_image_bytes
from .reader import ReaderConfig

__all__ = [
    "build_layout",
    "encode_qr",
    "decode_qr",
    "OMRResult",
    "process_image",
    "score_answers",
    "load_image_bytes",
    "ReaderConfig",
]
