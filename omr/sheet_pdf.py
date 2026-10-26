"""Sinh phiếu trả lời (PDF) từ SheetLayout bằng reportlab.

Có thể in phiếu trắng, hoặc phiếu "cá nhân hóa" cho từng thí sinh (in sẵn họ tên và
tô sẵn số báo danh) — mỗi thí sinh một trang trong cùng một file PDF.
"""
from __future__ import annotations

import io
import os
from dataclasses import dataclass
from pathlib import Path

from reportlab.graphics import renderPDF
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib.colors import Color, black, white
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

from . import layout as L

FONT, FONT_BOLD = "SheetFont", "SheetFont-Bold"
_fonts_ready = False

GRAY_TEXT = Color(0.55, 0.55, 0.55)
LINE = Color(0.15, 0.15, 0.15)


def _register_fonts() -> None:
    global _fonts_ready
    if _fonts_ready:
        return
    candidates = []
    win = Path(os.environ.get("WINDIR", "C:/Windows")) / "Fonts"
    candidates.append((win / "arial.ttf", win / "arialbd.ttf"))
    try:
        import matplotlib

        ttf = Path(matplotlib.get_data_path()) / "fonts" / "ttf"
        candidates.append((ttf / "DejaVuSans.ttf", ttf / "DejaVuSans-Bold.ttf"))
    except ImportError:
        pass
    for regular, bold in candidates:
        if regular.exists() and bold.exists():
            pdfmetrics.registerFont(TTFont(FONT, str(regular)))
            pdfmetrics.registerFont(TTFont(FONT_BOLD, str(bold)))
            _fonts_ready = True
            return
    raise RuntimeError("Không tìm thấy font TTF hỗ trợ tiếng Việt (Arial hoặc DejaVuSans)")


@dataclass
class SheetInfo:
    exam_id: int
    exam_name: str
    subject: str = ""
    exam_date: str = ""
    student_name: str = ""
    student_sbd: str = ""
    student_class: str = ""
    room: str = ""


def _X(x: float) -> float:
    return x * mm


def _Y(y: float) -> float:
    return (L.PAGE_H - y) * mm


def _circle(c: canvas.Canvas, b: L.Bubble, filled: bool, letter_size: float) -> None:
    c.setLineWidth(0.55)
    c.setStrokeColor(LINE)
    if filled:
        c.setFillColor(black)
        c.circle(_X(b.x), _Y(b.y), b.r * mm, stroke=1, fill=1)
        return
    c.setFillColor(white)
    c.circle(_X(b.x), _Y(b.y), b.r * mm, stroke=1, fill=0)
    c.setFillColor(GRAY_TEXT)
    c.setFont(FONT, letter_size)
    c.drawCentredString(_X(b.x), _Y(b.y) - letter_size * 0.36, b.label)


def _markers(c: canvas.Canvas) -> None:
    s = L.MARKER_SIZE
    for i, (cx, cy) in enumerate(L.MARKER_CENTERS):
        c.setFillColor(black)
        c.rect(_X(cx - s / 2), _Y(cy + s / 2), s * mm, s * mm, stroke=0, fill=1)
        if i == 0:
            h = L.MARKER_HOLE
            c.setFillColor(white)
            c.rect(_X(cx - h / 2), _Y(cy + h / 2), h * mm, h * mm, stroke=0, fill=1)


def _box(c: canvas.Canvas, r: L.Rect, width: float = 0.8) -> None:
    c.setLineWidth(width)
    c.setStrokeColor(LINE)
    c.rect(_X(r.x), _Y(r.y + r.h), r.w * mm, r.h * mm, stroke=1, fill=0)


def _digit_block(c: canvas.Canvas, block: L.FieldBlock, title: str, value: str) -> None:
    box = block.box
    # tiêu đề
    c.setFillColor(black)
    c.setFont(FONT_BOLD, 7.5)
    c.drawCentredString(_X(box.x + box.w / 2), _Y(box.y - 11.2), title)
    # hàng ô vuông để thí sinh viết số
    cell_y0 = box.y - 9.6
    for i, col in enumerate(block.items):
        x = col[0].x - L.DIGIT_PITCH / 2
        c.setLineWidth(0.6)
        c.rect(_X(x), _Y(cell_y0 + 7.0), L.DIGIT_PITCH * mm, 7.0 * mm, stroke=1, fill=0)
        if i < len(value) and value[i].isdigit():
            c.setFont(FONT_BOLD, 11)
            c.drawCentredString(_X(col[0].x), _Y(cell_y0 + 5.2), value[i])
    _box(c, box)
    for i, col in enumerate(block.items):
        digit = value[i] if i < len(value) else ""
        for b in col:
            _circle(c, b, filled=(b.label == digit), letter_size=6)


def _qr(c: canvas.Canvas, text: str) -> None:
    w = QrCodeWidget(text, barLevel="M", barBorder=0)
    x0, y0, x1, y1 = w.getBounds()
    size = L.QR_SIZE * mm
    d = Drawing(size, size, transform=[size / (x1 - x0), 0, 0, size / (y1 - y0), 0, 0])
    d.add(w)
    renderPDF.draw(d, c, _X(L.QR_X), _Y(L.QR_Y + L.QR_SIZE))


def _info_area(c: canvas.Canvas, info: SheetInfo) -> None:
    x0, x1, y = L.CONTENT_X0, 104.0, 37.0
    _box(c, L.Rect(x0, 33.0, x1 - x0, 71.0))
    rows = [
        ("Kỳ thi", info.exam_name),
        ("Môn thi", info.subject),
        ("Ngày thi", info.exam_date),
        ("Họ và tên", info.student_name),
        ("Lớp", info.student_class),
        ("Phòng thi", info.room),
    ]
    for label, value in rows:
        y += 6.6
        c.setFillColor(black)
        c.setFont(FONT, 8)
        c.drawString(_X(x0 + 2.5), _Y(y), f"{label}:")
        c.setStrokeColor(Color(0.6, 0.6, 0.6))
        c.setDash(0.6, 1.4)
        c.setLineWidth(0.4)
        c.line(_X(x0 + 19), _Y(y + 0.8), _X(x1 - 2.5), _Y(y + 0.8))
        c.setDash()
        if value:
            c.setFont(FONT_BOLD, 8.5)
            c.drawString(_X(x0 + 20), _Y(y), value[:48])
    # chữ ký
    y_sig = 84.0
    half = (x1 - x0) / 2
    c.setLineWidth(0.5)
    c.setStrokeColor(LINE)
    c.line(_X(x0), _Y(y_sig - 3), _X(x1), _Y(y_sig - 3))
    c.line(_X(x0 + half), _Y(y_sig - 3), _X(x0 + half), _Y(104.0))
    c.setFont(FONT, 7)
    c.drawCentredString(_X(x0 + half / 2), _Y(y_sig + 1), "Chữ ký giám thị 1")
    c.drawCentredString(_X(x0 + half * 1.5), _Y(y_sig + 1), "Chữ ký giám thị 2")


def _instructions(c: canvas.Canvas, exam_id: int) -> None:
    x = L.QR_X
    y = L.QR_Y + L.QR_SIZE + 4.5
    c.setFillColor(black)
    c.setFont(FONT_BOLD, 6.5)
    c.drawString(_X(x), _Y(y), f"Mã kỳ thi: #{exam_id}")
    c.setFont(FONT, 6.2)
    lines = ["Dùng bút chì 2B hoặc", "bút mực đen tô kín ô.", "Tô đúng:", "Tô sai:"]
    for i, t in enumerate(lines):
        c.drawString(_X(x), _Y(y + 4.0 + i * 3.4), t)
    # ví dụ tô đúng
    ok = L.Bubble(x + 13.0, y + 9.1 + 0.9, 1.4, "")
    c.setFillColor(black)
    c.circle(_X(ok.x), _Y(ok.y), ok.r * mm, stroke=1, fill=1)
    # ví dụ tô sai: dấu x, dấu tích, tô nửa
    yy = y + 13.4 + 0.0
    for k in range(3):
        bx = x + 11.0 + k * 4.2
        c.setFillColor(white)
        c.setLineWidth(0.5)
        c.circle(_X(bx), _Y(yy), 1.4 * mm, stroke=1, fill=0)
        c.setLineWidth(0.7)
        if k == 0:
            c.line(_X(bx - 1), _Y(yy - 1), _X(bx + 1), _Y(yy + 1))
            c.line(_X(bx - 1), _Y(yy + 1), _X(bx + 1), _Y(yy - 1))
        elif k == 1:
            c.line(_X(bx - 1), _Y(yy), _X(bx - 0.3), _Y(yy + 0.9))
            c.line(_X(bx - 0.3), _Y(yy + 0.9), _X(bx + 1.1), _Y(yy - 1))
        else:
            c.setFillColor(black)
            c.wedge(_X(bx) - 1.4 * mm, _Y(yy) - 1.4 * mm, _X(bx) + 1.4 * mm, _Y(yy) + 1.4 * mm, 90, 180, stroke=0, fill=1)


def _answers(c: canvas.Canvas, sheet: L.SheetLayout) -> None:
    c.setFillColor(black)
    c.setFont(FONT_BOLD, 8)
    c.drawString(_X(L.CONTENT_X0), _Y(L.ANS_TOP - 2.0), "PHẦN TRẢ LỜI")
    for block in sheet.answer_blocks:
        _box(c, block.box)
        first = block.items[0]
        c.setFont(FONT_BOLD, 7)
        c.setFillColor(black)
        for b in first:
            c.drawCentredString(_X(b.x), _Y(L.ANS_TOP + 4.6), b.label)
        for i, (row, key) in enumerate(zip(block.items, block.item_keys)):
            if i and i % L.ANS_GROUP == 0:
                yline = row[0].y - L.ANS_ROW_PITCH / 2 - L.ANS_GROUP_GAP / 2
                c.setStrokeColor(Color(0.75, 0.75, 0.75))
                c.setLineWidth(0.3)
                c.line(_X(block.box.x + 1.5), _Y(yline), _X(block.box.x + block.box.w - 1.5), _Y(yline))
            c.setFillColor(black)
            c.setFont(FONT_BOLD, 7.5)
            c.drawRightString(_X(row[0].x - 4.2), _Y(row[0].y) - 2.6, key)
            for b in row:
                _circle(c, b, filled=False, letter_size=5.6)


def draw_sheet(c: canvas.Canvas, sheet: L.SheetLayout, info: SheetInfo) -> None:
    _register_fonts()
    _markers(c)
    c.setFillColor(black)
    c.setFont(FONT_BOLD, 15)
    c.drawCentredString(_X(L.PAGE_W / 2 - 8), _Y(20.5), "PHIẾU TRẢ LỜI TRẮC NGHIỆM")
    c.setFont(FONT, 8.5)
    sub = " · ".join(p for p in (info.exam_name, info.subject, info.exam_date) if p)
    c.drawCentredString(_X(L.PAGE_W / 2 - 8), _Y(26.5), sub[:90])
    _info_area(c, info)
    _digit_block(c, sheet.sbd, "SỐ BÁO DANH", info.student_sbd)
    _digit_block(c, sheet.code, "MÃ ĐỀ", "")
    _qr(c, L.encode_qr(info.exam_id, sheet.num_questions, sheet.num_options))
    _instructions(c, info.exam_id)
    _answers(c, sheet)
    c.setFont(FONT, 6.5)
    c.setFillColor(GRAY_TEXT)
    c.drawCentredString(
        _X(L.PAGE_W / 2),
        _Y(L.PAGE_H - 5.5),
        f"Mã kỳ thi #{info.exam_id} · {sheet.num_questions} câu · Không gấp, không làm bẩn và không tô vào 4 ô vuông ở góc phiếu",
    )


def render_pdf(sheet: L.SheetLayout, infos: list[SheetInfo]) -> bytes:
    """Trả về nội dung PDF, mỗi phần tử trong `infos` là một trang."""
    _register_fonts()
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(L.PAGE_W * mm, L.PAGE_H * mm))
    c.setTitle(f"Phiếu trả lời — {infos[0].exam_name}" if infos else "Phiếu trả lời")
    for info in infos:
        draw_sheet(c, sheet, info)
        c.showPage()
    c.save()
    return buf.getvalue()


def render_png(pdf_bytes: bytes, dpi: int = 150, page: int = 0) -> bytes:
    import fitz  # PyMuPDF

    with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
        pix = doc[page].get_pixmap(dpi=dpi)
        return pix.tobytes("png")
