"""Sinh 4 bài mẫu 10 câu có điểm 10, 8, 5, 0 cho một kỳ thi.

Chạy: python -m tools.generate_manual --exam-id 3
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CASES = {
    "000001": "ABCDABCDAB",
    "000002": "ABCDABCDCC",
    "000003": "ABCDACDABC",
    "000004": "BCDABCDABC",
}


def generate(exam_id: int, out: Path) -> None:
    import cv2
    import pymupdf

    from omr import layout as L, synth

    blank = synth.render_blank(exam_id, 10, 4, "TEST_OMR_10")
    sheet = L.build_layout(10, 4)
    ppm = blank.shape[1] / L.PAGE_W
    out.mkdir(parents=True, exist_ok=True)
    truth = {}
    print(f"Output: {out}", flush=True)

    with pymupdf.open() as pdf:
        for idx, (sbd, answers) in enumerate(CASES.items(), 1):
            img = blank.copy()

            def mark(b):
                center = (round(b.x * ppm), round(b.y * ppm))
                cv2.circle(img, center, round(b.r * ppm * 0.85), (40, 40, 40), -1)

            for block, digits in ((sheet.sbd, sbd), (sheet.code, "101")):
                for row, digit in zip(block.items, digits):
                    mark(next(b for b in row if b.label == digit))
            for row, answer in zip(sheet.question_bubbles(), answers):
                mark(next(b for b in row if b.label == answer))

            clean_path = out / f"{sbd}_clean.png"
            if not cv2.imwrite(str(clean_path), img):
                raise OSError(f"Cannot write image: {clean_path}")
            photo, rotation = synth.photograph(img, seed=idx, strength=0.4, allow_rotation=False)
            name = f"{sbd}.jpg"
            if not cv2.imwrite(str(out / name), photo):
                raise OSError(f"Cannot write image: {out / name}")
            truth[name] = {
                "sbd": sbd, "exam_code": "101", "answers": list(answers),
                "erased": [], "rotation": rotation,
            }
            ok, encoded = cv2.imencode(".jpg", photo)
            if not ok:
                raise OSError(f"Cannot encode image: {name}")
            page = pdf.new_page(width=595.28, height=841.89)
            page.insert_image(page.rect, stream=encoded.tobytes())
            print(f"  Created {name} and {clean_path.name}", flush=True)

        # Write bytes so rerunning can replace the generated PDF as well as the images.
        (out / "four_pages.pdf").write_bytes(pdf.tobytes())

    (out / "truth.json").write_text(json.dumps(truth, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Done: 4 JPG, 4 PNG, four_pages.pdf, truth.json\n{out}", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate four 10-question test sheets (code 101).")
    parser.add_argument("--exam-id", required=True, type=int, help="ID of an existing 10-question, 4-option exam")
    parser.add_argument("--out", type=Path, help="Output directory; default: <project>/dataset/manual_<exam-id>")
    args = parser.parse_args()
    if args.exam_id < 1:
        parser.error("--exam-id must be a positive integer")
    out = (args.out if args.out is not None else ROOT / "dataset" / f"manual_{args.exam_id}").resolve()
    try:
        generate(args.exam_id, out)
    except ModuleNotFoundError as exc:
        parser.exit(1, f"Missing Python dependency: {exc.name}\nInstall using the same Python:\n"
                       f'"{sys.executable}" -m pip install -r "{ROOT / "requirements.txt"}"\n')


if __name__ == "__main__":
    main()
