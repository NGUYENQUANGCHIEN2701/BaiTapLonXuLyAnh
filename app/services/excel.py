"""Nhập/xuất Excel (openpyxl) và CSV."""
from __future__ import annotations

import csv
import io
import unicodedata

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

from ..models import Exam, Student, Submission

HEADER_FILL = PatternFill("solid", fgColor="1E3A8A")
HEADER_FONT = Font(bold=True, color="FFFFFF")
THIN = Side(style="thin", color="CBD5E1")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
STATUS_VI = {"graded": "Đã chấm", "review": "Cần xem lại", "error": "Lỗi"}


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFD", str(s or "")).encode("ascii", "ignore").decode().lower()
    return "".join(ch for ch in s if ch.isalnum())


def read_table(data: bytes, filename: str) -> list[list[str]]:
    """Đọc file .xlsx hoặc .csv thành danh sách hàng (chuỗi)."""
    if filename.lower().endswith((".xlsx", ".xlsm")):
        wb = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
        ws = wb.active
        rows = [["" if v is None else str(v).strip() for v in row] for row in ws.iter_rows(values_only=True)]
    else:
        text = data.decode("utf-8-sig", errors="replace")
        dialect = csv.Sniffer().sniff(text[:2048], delimiters=",;\t") if text.strip() else csv.excel
        rows = [[c.strip() for c in r] for r in csv.reader(io.StringIO(text), dialect)]
    return [r for r in rows if any(c for c in r)]


def _clean_int_str(v: str) -> str:
    v = v.strip()
    if v.endswith(".0"):
        v = v[:-2]
    return v


STUDENT_COLS = {
    "sbd": ["sbd", "sobaodanh", "mathisinh", "id"],
    "full_name": ["hoten", "hovaten", "ten", "name", "fullname"],
    "dob": ["ngaysinh", "dob", "birthday"],
    "class_name": ["lop", "class", "classname"],
    "room": ["phong", "phongthi", "room"],
}


def parse_students(rows: list[list[str]]) -> tuple[list[dict], list[str]]:
    if not rows:
        return [], ["File trống"]
    header = [_norm(c) for c in rows[0]]
    idx = {}
    for field, names in STUDENT_COLS.items():
        for i, h in enumerate(header):
            if h in names:
                idx[field] = i
                break
    if "sbd" not in idx or "full_name" not in idx:
        return [], ["Thiếu cột 'SBD' hoặc 'Họ tên' ở dòng tiêu đề"]
    out, errors = [], []
    for n, r in enumerate(rows[1:], start=2):
        get = lambda f: (r[idx[f]] if f in idx and idx[f] < len(r) else "").strip()  # noqa: E731
        sbd = _clean_int_str(get("sbd"))
        if not sbd.isdigit() or len(sbd) > 6:
            errors.append(f"Dòng {n}: SBD '{sbd}' không hợp lệ (tối đa 6 chữ số)")
            continue
        if not get("full_name"):
            errors.append(f"Dòng {n}: thiếu họ tên")
            continue
        out.append({"sbd": sbd.zfill(6), "full_name": get("full_name"), "dob": get("dob"),
                    "class_name": get("class_name"), "room": get("room")})
    return out, errors


def parse_keys(rows: list[list[str]], num_questions: int) -> tuple[dict[str, list[str]], list[str]]:
    """Hỗ trợ 2 dạng:
    - Dạng cột: dòng tiêu đề 'Câu | 101 | 102 ...', mỗi dòng một câu.
    - Dạng hàng: mỗi dòng 'Mã đề | ABCD...' hoặc 'Mã đề | A | B | C ...'.
    """
    if not rows:
        return {}, ["File trống"]
    errors: list[str] = []
    head = rows[0]
    keys: dict[str, list[str]] = {}
    if _norm(head[0]) in ("cau", "question", "q", "stt") and len(head) > 1:
        codes = [_clean_int_str(c) for c in head[1:]]
        for c in codes:
            if c.isdigit():
                keys[c.zfill(3)] = [""] * num_questions
        for r in rows[1:]:
            q = _clean_int_str(r[0])
            if not q.isdigit() or not 1 <= int(q) <= num_questions:
                continue
            for j, c in enumerate(codes):
                if c.isdigit() and j + 1 < len(r):
                    keys[c.zfill(3)][int(q) - 1] = r[j + 1].strip().upper()
    else:
        start = 1 if not _clean_int_str(head[0]).isdigit() else 0
        for n, r in enumerate(rows[start:], start=start + 1):
            code = _clean_int_str(r[0])
            if not code.isdigit():
                errors.append(f"Dòng {n}: mã đề '{code}' không hợp lệ")
                continue
            cells = [c.strip().upper() for c in r[1:] if c.strip()]
            ans = list(cells[0]) if len(cells) == 1 and len(cells[0]) > 1 else cells
            keys[code.zfill(3)] = (ans + [""] * num_questions)[:num_questions]
    for code, ans in keys.items():
        missing = [str(i + 1) for i, a in enumerate(ans) if not a]
        if missing:
            errors.append(f"Mã đề {code}: thiếu đáp án câu {', '.join(missing[:10])}{'...' if len(missing) > 10 else ''}")
    return keys, errors


def _style_header(ws, ncols: int, row: int = 1) -> None:
    for c in range(1, ncols + 1):
        cell = ws.cell(row=row, column=c)
        cell.fill, cell.font, cell.border = HEADER_FILL, HEADER_FONT, BORDER
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)


def _autowidth(ws, min_w: int = 6, max_w: int = 40) -> None:
    for col in ws.columns:
        length = max((len(str(c.value)) if c.value is not None else 0) for c in col)
        ws.column_dimensions[get_column_letter(col[0].column)].width = max(min_w, min(max_w, length + 2))


def student_template() -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Thí sinh"
    ws.append(["SBD", "Họ tên", "Ngày sinh", "Lớp", "Phòng thi"])
    ws.append(["000001", "Nguyễn Văn An", "01/01/2006", "12A1", "P101"])
    ws.append(["000002", "Trần Thị Bình", "15/03/2006", "12A2", "P101"])
    _style_header(ws, 5)
    _autowidth(ws, 12)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def key_template(num_questions: int, codes=("101", "102")) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Đáp án"
    ws.append(["Câu", *codes])
    for q in range(1, num_questions + 1):
        ws.append([q, *["" for _ in codes]])
    _style_header(ws, len(codes) + 1)
    _autowidth(ws, 10)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def export_results(exam: Exam, subs: list[Submission], students: list[Student], item_stats: list[dict]) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Bảng điểm"
    ws.append([f"BẢNG ĐIỂM — {exam.name}"])
    ws.append([f"Môn: {exam.subject}   Ngày thi: {exam.exam_date}   Số câu: {exam.num_questions}   Thang điểm: {exam.max_score:g}"])
    ws["A1"].font = Font(bold=True, size=14, color="1E3A8A")
    ws.append([])
    cols = ["STT", "SBD", "Họ tên", "Lớp", "Phòng", "Mã đề", "Số câu đúng", "Điểm", "Kết quả", "Trạng thái", "Ghi chú"]
    ws.append(cols)
    _style_header(ws, len(cols), row=4)
    by_student = {s.student_id: s for s in subs if s.student_id}
    st_map = {s.id: s for s in students}
    rows = []
    for st in sorted(students, key=lambda s: s.sbd):
        sub = by_student.get(st.id)
        rows.append((st, sub))
    for sub in subs:
        if not sub.student_id:
            rows.append((None, sub))
    for i, (st, sub) in enumerate(rows, 1):
        note = "Vắng / chưa nộp bài" if sub is None else "; ".join(f["message"] for f in sub.flags if f.get("kind") != "warning")
        result = ""
        if sub is not None and sub.score is not None:
            result = "Đạt" if sub.score >= exam.pass_score else "Chưa đạt"
        ws.append([
            i,
            st.sbd if st else (sub.sbd if sub else ""),
            st.full_name if st else "(không có trong danh sách)",
            st.class_name if st else "",
            st.room if st else "",
            sub.exam_code if sub else "",
            sub.num_correct if sub else None,
            sub.score if sub else None,
            result,
            STATUS_VI.get(sub.status, sub.status) if sub else "Vắng",
            note,
        ])
        r = ws.max_row
        for c in range(1, len(cols) + 1):
            ws.cell(row=r, column=c).border = BORDER
        if sub is not None and sub.status == "review":
            for c in range(1, len(cols) + 1):
                ws.cell(row=r, column=c).fill = PatternFill("solid", fgColor="FEF3C7")
        if sub is None:
            for c in range(1, len(cols) + 1):
                ws.cell(row=r, column=c).font = Font(color="94A3B8")
    _autowidth(ws)
    ws.column_dimensions["A"].width = 6
    ws.freeze_panes = "A5"

    # chi tiết bài làm
    ws2 = wb.create_sheet("Chi tiết bài làm")
    head = ["SBD", "Họ tên", "Mã đề", "Điểm", *[f"C{q + 1}" for q in range(exam.num_questions)]]
    ws2.append(head)
    _style_header(ws2, len(head))
    for sub in sorted(subs, key=lambda s: s.sbd):
        st = st_map.get(sub.student_id)
        ws2.append([sub.sbd, st.full_name if st else "", sub.exam_code, sub.score,
                    *[a or "-" for a in (sub.answers + [""] * exam.num_questions)[: exam.num_questions]]])
    _autowidth(ws2, 4, 28)
    ws2.freeze_panes = "E2"

    # thống kê câu hỏi
    if item_stats:
        ws3 = wb.create_sheet("Phân tích câu hỏi")
        opts = list("ABCDEF"[: exam.num_options])
        head = ["Câu", "Đáp án", "Tỉ lệ đúng", "Độ khó", "Độ phân biệt", "Đánh giá", *opts, "Bỏ trống", "Tô nhiều"]
        ws3.append(head)
        _style_header(ws3, len(head))
        for it in item_stats:
            ws3.append([it["q"], it["key"], it["p"], it["difficulty"], it["d"], it["discrimination"],
                        *[it["options"][o] for o in opts], it["blank"], it["multi"]])
            ws3.cell(row=ws3.max_row, column=3).number_format = "0.0%"
        _autowidth(ws3, 8)

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()
