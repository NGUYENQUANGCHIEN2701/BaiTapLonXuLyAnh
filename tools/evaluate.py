"""Sinh bộ dữ liệu tổng hợp và đánh giá độ chính xác của lõi OMR.

Ví dụ:
    python -m tools.evaluate --n 200 --questions 60 --out dataset/synthetic
    python -m tools.evaluate --eval-only --out dataset/synthetic
    python -m tools.evaluate --eval-only --out dataset/real      # ảnh thật + truth.json tự gán nhãn
"""
from __future__ import annotations

import argparse
import json
import statistics
import sys
from pathlib import Path

import cv2

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from omr import process_image, synth  # noqa: E402


def generate(out: Path, n: int, questions: int, options: int, exam_id: int) -> None:
    out.mkdir(parents=True, exist_ok=True)
    blank = synth.render_blank(exam_id, questions, options)
    cv2.imwrite(str(out / "blank.png"), blank)
    truth = {}
    for i in range(n):
        strength = 0.4 + 1.1 * (i % 10) / 9  # 0.4 .. 1.5: từ dễ tới khó
        filled, t = synth.fill_sheet(blank, questions, options, seed=i)
        photo, rot = synth.photograph(filled, seed=10_000 + i, strength=strength)
        t.rotation = rot
        name = f"sheet_{i:04d}.jpg"
        cv2.imwrite(str(out / name), photo)
        truth[name] = {**t.to_dict(), "strength": round(strength, 2)}
    (out / "truth.json").write_text(json.dumps(truth, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Đã sinh {n} ảnh vào {out}")


def evaluate(out: Path) -> dict:
    truth = json.loads((out / "truth.json").read_text(encoding="utf-8"))
    stats = {"sheets": 0, "aligned": 0, "sbd_ok": 0, "code_ok": 0, "sheet_perfect": 0,
             "q_total": 0, "q_ok": 0, "q_wrong_unflagged": 0, "flagged_sheets": 0,
             "multi_total": 0, "multi_detected": 0, "erased_total": 0, "erased_ok": 0,
             "false_flags": 0, "qr_ok": 0, "erased_flagged": 0}
    times, failures = [], []
    for name, t in truth.items():
        img = cv2.imread(str(out / name))
        stats["sheets"] += 1
        r = process_image(img, num_questions=len(t["answers"]))
        times.append(r.elapsed_ms)
        if not r.ok:
            failures.append((name, r.error))
            continue
        stats["aligned"] += 1
        stats["qr_ok"] += r.qr is not None
        stats["sbd_ok"] += r.sbd == t["sbd"]
        stats["code_ok"] += r.exam_code == t["exam_code"]
        flagged_q = {f.field for f in r.flags}
        perfect = r.sbd == t["sbd"] and r.exam_code == t["exam_code"]
        for i, (a, g) in enumerate(zip(r.answers, t["answers"]), 1):
            stats["q_total"] += 1
            ok = a == g
            stats["q_ok"] += ok
            perfect &= ok
            if not ok and f"q{i}" not in flagged_q:
                stats["q_wrong_unflagged"] += 1
            if len(g) > 1:
                stats["multi_total"] += 1
                stats["multi_detected"] += ok
            if i in t.get("erased", []):
                stats["erased_total"] += 1
                stats["erased_ok"] += ok
                stats["erased_flagged"] += f"q{i}" in flagged_q
            elif ok and len(g) <= 1 and f"q{i}" in flagged_q:
                stats["false_flags"] += 1
        stats["sheet_perfect"] += perfect
        stats["flagged_sheets"] += r.needs_review
        if not perfect:
            failures.append((name, f"sbd {r.sbd}/{t['sbd']} code {r.exam_code}/{t['exam_code']} "
                                   f"sai {[i + 1 for i, (a, g) in enumerate(zip(r.answers, t['answers'])) if a != g]}"))

    def pct(a, b):
        return round(100 * a / b, 2) if b else None

    report = {
        "Số ảnh": stats["sheets"],
        "Căn chỉnh thành công (%)": pct(stats["aligned"], stats["sheets"]),
        "Đọc đúng SBD (%)": pct(stats["sbd_ok"], stats["aligned"]),
        "Đọc đúng mã đề (%)": pct(stats["code_ok"], stats["aligned"]),
        "Đọc đúng từng câu (%)": pct(stats["q_ok"], stats["q_total"]),
        "Phiếu đúng hoàn toàn (%)": pct(stats["sheet_perfect"], stats["sheets"]),
        "Câu sai mà KHÔNG bị gắn cờ": stats["q_wrong_unflagged"],
        "Phát hiện tô nhiều ô (%)": pct(stats["multi_detected"], stats["multi_total"]),
        "Bỏ qua đúng vết tẩy (%)": pct(stats["erased_ok"], stats["erased_total"]),
        "Gắn cờ vết tẩy để duyệt (%)": pct(stats["erased_flagged"], stats["erased_total"]),
        "Đọc được mã QR (%)": pct(stats["qr_ok"], stats["aligned"]),
        "Cờ báo nhầm (% số câu)": pct(stats["false_flags"], stats["q_total"]),
        "Phiếu cần xem lại (%)": pct(stats["flagged_sheets"], stats["aligned"]),
        "Thời gian TB (ms/phiếu)": round(statistics.mean(times), 1) if times else None,
    }
    for k, v in report.items():
        print(f"{k:32s} {v}")
    if failures:
        print("\nCác phiếu chưa đúng hoàn toàn:")
        for name, why in failures[:30]:
            print(f"  {name}: {why}")
    (out / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
    return report


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, default=Path("dataset/synthetic"))
    ap.add_argument("--n", type=int, default=100)
    ap.add_argument("--questions", type=int, default=60)
    ap.add_argument("--options", type=int, default=4)
    ap.add_argument("--exam-id", type=int, default=1)
    ap.add_argument("--eval-only", action="store_true")
    args = ap.parse_args()
    if not args.eval_only:
        generate(args.out, args.n, args.questions, args.options, args.exam_id)
    evaluate(args.out)


if __name__ == "__main__":
    main()
