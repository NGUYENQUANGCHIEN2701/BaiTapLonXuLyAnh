"""Bố cục phiếu trả lời — nguồn tọa độ duy nhất cho cả bước IN phiếu và bước ĐỌC phiếu.

Mọi tọa độ tính bằng milimét trên khổ A4 dọc, gốc (0, 0) ở góc trên-trái tờ giấy.
Vì phiếu do chính hệ thống sinh ra, ta biết chính xác vị trí từng ô tròn; nhiệm vụ của
bước xử lý ảnh chỉ còn là đưa ảnh chụp về đúng hệ tọa độ này (xem alignment.py).
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

LAYOUT_VERSION = 1

PAGE_W, PAGE_H = 210.0, 297.0

# 4 marker vuông đen ở 4 góc. Marker góc trên-trái là hình vuông "rỗng ruột"
# (có ô trắng ở giữa) để xác định chiều của phiếu khi ảnh bị xoay 90/180/270 độ.
MARKER_SIZE = 8.0
MARKER_HOLE = 3.6
MARKER_INSET = 11.0  # khoảng cách từ mép giấy tới TÂM marker
MARKER_CENTERS = (
    (MARKER_INSET, MARKER_INSET),                    # TL (rỗng)
    (PAGE_W - MARKER_INSET, MARKER_INSET),           # TR
    (PAGE_W - MARKER_INSET, PAGE_H - MARKER_INSET),  # BR
    (MARKER_INSET, PAGE_H - MARKER_INSET),           # BL
)

CONTENT_X0, CONTENT_X1 = 18.0, 192.0

# Khối số báo danh / mã đề
DIGIT_R = 2.0
DIGIT_PITCH = 5.4
DIGIT_ROW0 = 50.0
SBD_LEN = 6
CODE_LEN = 3
SBD_X0 = 112.0
CODE_X0 = 151.0

# Mã QR chứa mã kỳ thi + cấu hình phiếu
QR_X, QR_Y, QR_SIZE = 168.0, 35.0, 24.0

# Khối câu trả lời
ANS_TOP = 110.0
ANS_COLS = 4
ANS_R = 2.1
ANS_OPT_PITCH = 6.4
ANS_ROW_PITCH = 5.0
ANS_GROUP = 5
ANS_GROUP_GAP = 2.0
ANS_FIRST_ROW = ANS_TOP + 8.0

MAX_QUESTIONS = 120
OPTION_LABELS = "ABCDEF"


@dataclass(frozen=True)
class Bubble:
    x: float
    y: float
    r: float
    label: str


@dataclass(frozen=True)
class Rect:
    x: float
    y: float
    w: float
    h: float


@dataclass
class FieldBlock:
    """Một nhóm ô tròn được căn chỉnh chung (một cột câu hỏi, khối SBD, khối mã đề)."""

    name: str
    box: Rect
    # rows[i] là danh sách ô của "câu" thứ i trong khối (với SBD: mỗi "câu" là một chữ số)
    items: list[list[Bubble]]
    item_keys: list[str]


@dataclass
class SheetLayout:
    num_questions: int
    num_options: int
    sbd: FieldBlock
    code: FieldBlock
    answer_blocks: list[FieldBlock] = field(default_factory=list)

    @property
    def blocks(self) -> list[FieldBlock]:
        return [self.sbd, self.code, *self.answer_blocks]

    @property
    def options(self) -> str:
        return OPTION_LABELS[: self.num_options]

    def question_bubbles(self) -> list[list[Bubble]]:
        out: list[list[Bubble]] = []
        for b in self.answer_blocks:
            out.extend(b.items)
        return out


def rows_per_column(num_questions: int) -> int:
    per_col = math.ceil(num_questions / ANS_COLS)
    return max(ANS_GROUP, math.ceil(per_col / ANS_GROUP) * ANS_GROUP)


def answer_row_y(row: int) -> float:
    return ANS_FIRST_ROW + row * ANS_ROW_PITCH + (row // ANS_GROUP) * ANS_GROUP_GAP


def _digit_block(name: str, x0: float, length: int) -> FieldBlock:
    items = []
    for c in range(length):
        x = x0 + c * DIGIT_PITCH
        items.append([Bubble(x, DIGIT_ROW0 + d * DIGIT_PITCH, DIGIT_R, str(d)) for d in range(10)])
    pad = DIGIT_R + 1.2
    box = Rect(
        x0 - pad,
        DIGIT_ROW0 - pad,
        (length - 1) * DIGIT_PITCH + 2 * pad,
        9 * DIGIT_PITCH + 2 * pad,
    )
    return FieldBlock(name, box, items, [f"{name}{i + 1}" for i in range(length)])


def build_layout(num_questions: int, num_options: int = 4) -> SheetLayout:
    if not 1 <= num_questions <= MAX_QUESTIONS:
        raise ValueError(f"Số câu phải trong khoảng 1..{MAX_QUESTIONS}")
    if not 2 <= num_options <= len(OPTION_LABELS):
        raise ValueError(f"Số phương án phải trong khoảng 2..{len(OPTION_LABELS)}")

    sbd = _digit_block("sbd", SBD_X0, SBD_LEN)
    code = _digit_block("code", CODE_X0, CODE_LEN)

    rows = rows_per_column(num_questions)
    col_w = (CONTENT_X1 - CONTENT_X0) / ANS_COLS
    opts = OPTION_LABELS[:num_options]
    opt_span = (num_options - 1) * ANS_OPT_PITCH
    label_w = 9.0
    blocks: list[FieldBlock] = []
    q = 0
    for c in range(ANS_COLS):
        if q >= num_questions:
            break
        col_x = CONTENT_X0 + c * col_w
        # căn giữa (nhãn + các ô) trong cột
        x_first = col_x + (col_w - (label_w + opt_span)) / 2 + label_w
        items, keys = [], []
        for r in range(rows):
            if q >= num_questions:
                break
            y = answer_row_y(r)
            items.append([Bubble(x_first + i * ANS_OPT_PITCH, y, ANS_R, o) for i, o in enumerate(opts)])
            keys.append(str(q + 1))
            q += 1
        last_y = answer_row_y(len(items) - 1)
        box = Rect(col_x + 1.0, ANS_TOP, col_w - 2.0, last_y + ANS_R + 3.0 - ANS_TOP)
        blocks.append(FieldBlock(f"col{c + 1}", box, items, keys))

    return SheetLayout(num_questions, num_options, sbd, code, blocks)


# ---- Nội dung mã QR -------------------------------------------------------------

QR_PREFIX = "OMRX"


def encode_qr(exam_id: int, num_questions: int, num_options: int) -> str:
    return f"{QR_PREFIX}|{LAYOUT_VERSION}|{exam_id}|{num_questions}|{num_options}"


def decode_qr(text: str) -> dict | None:
    parts = (text or "").strip().split("|")
    if len(parts) != 5 or parts[0] != QR_PREFIX:
        return None
    try:
        version, exam_id, nq, no = (int(p) for p in parts[1:])
    except ValueError:
        return None
    return {"layout_version": version, "exam_id": exam_id, "num_questions": nq, "num_options": no}
