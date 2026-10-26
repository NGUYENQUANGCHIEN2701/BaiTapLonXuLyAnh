"""So sánh lõi OMR của hệ thống với OMRChecker (Udayraj123/OMRChecker) trên cùng bộ dữ liệu.

Script tự sinh template.json/config.json/ảnh marker theo định dạng của OMRChecker từ chính
bố cục phiếu (omr/layout.py), chạy OMRChecker bằng subprocess rồi chấm cả hai so với đáp án thật.

    python -m tools.omrchecker_baseline --data dataset/synthetic
Yêu cầu: đã clone OMRChecker vào reference/OMRChecker và cài requirements của nó.
"""
from __future__ import annotations

import argparse
import csv
import json
import shutil
import subprocess
import sys
import time
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from omr import layout as L  # noqa: E402
from omr import process_image  # noqa: E402

OMRC = ROOT / "reference" / "OMRChecker"
PPM_T = 4.0  # px/mm của ảnh sau khi OMRChecker cắt theo marker
X0, Y0 = L.MARKER_CENTERS[0]  # OMRChecker cắt ảnh theo TÂM 4 marker


def _pt(x_mm: float, y_mm: float) -> list[int]:
    return [round((x_mm - X0) * PPM_T), round((y_mm - Y0) * PPM_T)]


def build_template(num_questions: int, num_options: int, marker_ratio: int = 21) -> dict:
    sheet = L.build_layout(num_questions, num_options)
    blocks: dict[str, dict] = {}
    r = L.DIGIT_R
    for name, block in (("SBD", sheet.sbd), ("MaDe", sheet.code)):
        first = block.items[0][0]
        blocks[name] = {
            "fieldType": "QTYPE_INT",
            "origin": _pt(first.x - r, first.y - r),
            "fieldLabels": [f"{block.name}1..{len(block.items)}"],
            "bubblesGap": round(L.DIGIT_PITCH * PPM_T, 2),
            "labelsGap": round(L.DIGIT_PITCH * PPM_T, 2),
            "bubbleDimensions": [round(2 * r * PPM_T)] * 2,
        }
    # mỗi nhóm 5 câu là một block (vì giữa các nhóm có khoảng cách lớn hơn)
    ftype = {4: "QTYPE_MCQ4", 5: "QTYPE_MCQ5"}.get(num_options)
    custom = {}
    for block in sheet.answer_blocks:
        for g in range(0, len(block.items), L.ANS_GROUP):
            rows = block.items[g : g + L.ANS_GROUP]
            keys = block.item_keys[g : g + L.ANS_GROUP]
            first = rows[0][0]
            spec = {
                "origin": _pt(first.x - L.ANS_R, first.y - L.ANS_R),
                "fieldLabels": [f"q{keys[0]}..{keys[-1]}"] if len(keys) > 1 else [f"q{keys[0]}"],
                "bubblesGap": round(L.ANS_OPT_PITCH * PPM_T, 2),
                "labelsGap": round(L.ANS_ROW_PITCH * PPM_T, 2),
            }
            if ftype:
                spec["fieldType"] = ftype
            else:
                spec.update(bubbleValues=list(L.OPTION_LABELS[:num_options]), direction="horizontal")
            blocks[f"Q{block.name}_{g // L.ANS_GROUP + 1}"] = spec
    custom["sbd"] = [f"sbd1..{L.SBD_LEN}"]
    custom["code"] = [f"code1..{L.CODE_LEN}"]
    w = round((L.MARKER_CENTERS[1][0] - X0) * PPM_T)
    h = round((L.MARKER_CENTERS[3][1] - Y0) * PPM_T)
    return {
        "pageDimensions": [w, h],
        "bubbleDimensions": [round(2 * L.ANS_R * PPM_T)] * 2,
        "preProcessors": [{
            "name": "CropOnMarkers",
            "options": {"relativePath": "omr_marker.jpg", "sheetToMarkerWidthRatio": marker_ratio},
        }],
        "customLabels": custom,
        "fieldBlocks": blocks,
        "outputColumns": ["sbd", "code", f"q1..{num_questions}"],
        "emptyValue": "",
    }


CONFIG = {
    "dimensions": {"processing_width": 1000, "processing_height": 1300, "display_width": 1000, "display_height": 1300},
    "outputs": {"show_image_level": 0, "save_image_level": 0},
}


def marker_image() -> np.ndarray:
    s = 60
    img = np.full((s, s), 255, np.uint8)
    pad = 6
    img[pad : s - pad, pad : s - pad] = 0
    return img


def run_omrchecker(data: Path, names: list[str], nq: int, no: int, work: Path, marker_ratio: int = 21) -> tuple[dict[str, dict], float]:
    inp = work / "input"
    out = work / "output"
    shutil.rmtree(work, ignore_errors=True)
    inp.mkdir(parents=True)
    (inp / "template.json").write_text(json.dumps(build_template(nq, no, marker_ratio), indent=1), encoding="utf-8")
    (inp / "config.json").write_text(json.dumps(CONFIG, indent=1), encoding="utf-8")
    cv2.imwrite(str(inp / "omr_marker.jpg"), marker_image())
    for n in names:
        shutil.copy(data / n, inp / n)
    t0 = time.perf_counter()
    proc = subprocess.run([sys.executable, "main.py", "-i", str(inp), "-o", str(out)], cwd=OMRC,
                          capture_output=True, text=True, encoding="utf-8", errors="replace",
                          env={**__import__("os").environ, "PYTHONIOENCODING": "utf-8", "MPLBACKEND": "Agg"})
    elapsed = time.perf_counter() - t0
    if proc.returncode != 0:
        print(proc.stdout[-3000:], proc.stderr[-3000:])
        raise SystemExit("OMRChecker lỗi")
    rows: dict[str, dict] = {}
    for f in (out / "Results").glob("*.csv"):
        with open(f, encoding="utf-8") as fh:
            for row in csv.DictReader(fh):
                rows[Path(row["file_id"]).name] = row
    for f in (out / "Manual").glob("ErrorFiles*.csv"):
        with open(f, encoding="utf-8") as fh:
            for row in csv.DictReader(fh):
                rows.setdefault(Path(row["file_id"]).name, {"_error": True})
    return rows, elapsed


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", type=Path, default=ROOT / "dataset" / "synthetic")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--marker-ratio", type=int, default=21, help="sheetToMarkerWidthRatio của OMRChecker")
    ap.add_argument("--include-rotated", action="store_true", help="OMRChecker không tự xoay ảnh; mặc định chỉ so sánh ảnh không xoay")
    args = ap.parse_args()
    truth = json.loads((args.data / "truth.json").read_text(encoding="utf-8"))
    names = [n for n, t in truth.items() if args.include_rotated or t.get("rotation", 0) == 0]
    if args.limit:
        names = names[: args.limit]
    nq = len(next(iter(truth.values()))["answers"])
    no = 4
    print(f"So sánh trên {len(names)} ảnh ({nq} câu)...")

    oc_rows, oc_time = run_omrchecker(args.data, names, nq, no, ROOT / "dataset" / "_omrchecker_run", args.marker_ratio)

    def score(get) -> dict:
        s = {"processed": 0, "sbd": 0, "code": 0, "q_ok": 0, "q_total": 0, "perfect": 0}
        for n in names:
            t = truth[n]
            r = get(n)
            s["q_total"] += nq
            if r is None:
                continue
            s["processed"] += 1
            s["sbd"] += r["sbd"] == t["sbd"]
            s["code"] += r["code"] == t["exam_code"]
            ok = sum(a == g for a, g in zip(r["answers"], t["answers"]))
            s["q_ok"] += ok
            s["perfect"] += ok == nq and r["sbd"] == t["sbd"] and r["code"] == t["exam_code"]
        return s

    def from_oc(n):
        row = oc_rows.get(n)
        if not row or row.get("_error"):
            return None
        # OMRChecker ghép nhiều ô tô của một câu thành chuỗi, ví dụ "AC"
        return {"sbd": row.get("sbd", ""), "code": row.get("code", ""),
                "answers": ["".join(sorted(row.get(f"q{i}", "") or "")) for i in range(1, nq + 1)]}

    ours_time = 0.0
    ours_cache = {}

    def from_ours(n):
        nonlocal ours_time
        img = cv2.imread(str(args.data / n))
        t0 = time.perf_counter()
        r = process_image(img, nq, no)
        ours_time += time.perf_counter() - t0
        if not r.ok:
            return None
        ours_cache[n] = r
        return {"sbd": r.sbd, "code": r.exam_code, "answers": r.answers}

    a, b = score(from_oc), score(from_ours)
    N = len(names)

    def pct(x, y):
        return f"{100 * x / y:6.2f}%" if y else "   —  "

    print(f"\n{'Chỉ số':34s} {'OMRChecker':>12s} {'Hệ thống này':>14s}")
    for label, ka in [("Xử lý được ảnh", "processed"), ("Đọc đúng SBD", "sbd"), ("Đọc đúng mã đề", "code"), ("Phiếu đúng hoàn toàn", "perfect")]:
        print(f"{label:34s} {pct(a[ka], N):>12s} {pct(b[ka], N):>14s}")
    print(f"{'Đọc đúng từng câu (trên mọi ảnh)':34s} {pct(a['q_ok'], a['q_total']):>12s} {pct(b['q_ok'], b['q_total']):>14s}")
    print(f"{'Đọc đúng từng câu (ảnh xử lý được)':34s} {pct(a['q_ok'], a['processed'] * nq):>12s} {pct(b['q_ok'], b['processed'] * nq):>14s}")
    print(f"{'Thời gian (ms/ảnh)':34s} {1000 * oc_time / N:>12.0f} {1000 * ours_time / N:>14.0f}")
    print("\n(Thời gian OMRChecker gồm cả khởi động tiến trình; so sánh chỉ mang tính tham khảo.)")
    report = {"n": N, "omrchecker": a, "ours": b, "omrchecker_ms": 1000 * oc_time / N, "ours_ms": 1000 * ours_time / N}
    (args.data / "compare_omrchecker.json").write_text(json.dumps(report, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
