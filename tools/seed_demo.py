"""Tạo dữ liệu demo đầy đủ (tài khoản giáo viên, 2 kỳ thi, đáp án, thí sinh, bài làm đã chấm).

    python -m tools.seed_demo            # thêm vào CSDL hiện tại (data/app.db)
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    with TestClient(app) as c:
        r = c.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
        r.raise_for_status()
        c.post("/api/users", json={"username": "giaovien", "full_name": "Cô Nguyễn Thu Hà", "password": "123456", "role": "teacher"})
        exams = [
            {"name": "Kiểm tra giữa kỳ I", "subject": "Toán 12", "exam_date": "2026-10-20", "num_questions": 50,
             "description": "Đề gồm 3 mã đề, thời gian 90 phút.", "n": 45},
            {"name": "Thi thử tốt nghiệp lần 1", "subject": "Tiếng Anh", "exam_date": "2026-10-24", "num_questions": 40, "n": 30},
        ]
        for e in exams:
            n = e.pop("n")
            exam = c.post("/api/exams", json=e).json()
            print(f"Kỳ thi #{exam['id']}: {exam['name']} — đang sinh {n} phiếu...", flush=True)
            res = c.post(f"/api/exams/{exam['id']}/demo?n={n}").json()
            print(f"  -> {res}")
    print("Xong. Đăng nhập: admin/admin123 hoặc giaovien/123456")


if __name__ == "__main__":
    main()
