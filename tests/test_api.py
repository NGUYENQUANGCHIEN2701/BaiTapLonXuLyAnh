"""Kiểm thử toàn luồng API. Chạy: python -m pytest tests -q"""
import os
import tempfile

os.environ["OMR_DATA_DIR"] = tempfile.mkdtemp(prefix="omr_test_")

import cv2  # noqa: E402
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from omr import synth  # noqa: E402


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        r = c.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
        assert r.status_code == 200, r.text
        yield c


def _photo(exam_id, nq, sbd, code, seed):
    blank = synth.render_blank(exam_id, nq)
    filled, truth = synth.fill_sheet(blank, nq, seed=seed, sbd=sbd, exam_code=code, p_multi=0, p_blank=0, p_erased=0)
    photo, _ = synth.photograph(filled, seed=seed, strength=0.6)
    ok, enc = cv2.imencode(".jpg", photo)
    return enc.tobytes(), truth


def test_full_flow(client):
    r = client.get("/api/auth/me")
    assert r.json()["role"] == "admin"

    exam = client.post("/api/exams", json={"name": "Giữa kỳ", "subject": "Xử lý ảnh", "num_questions": 40}).json()
    eid = exam["id"]

    assert client.get(f"/api/exams/{eid}/sheet.pdf").headers["content-type"] == "application/pdf"

    # đáp án dạng chuỗi
    key = "ABCD" * 10
    r = client.post(f"/api/exams/{eid}/keys", json={"code": "101", "answers": key})
    assert r.status_code == 200, r.text

    # danh sách thí sinh qua CSV
    csv = "SBD,Họ tên,Lớp\n123456,Nguyễn Văn A,12A1\n654321,Trần Thị B,12A2\n".encode()
    r = client.post(f"/api/exams/{eid}/students/import", files={"file": ("ds.csv", csv, "text/csv")})
    assert r.json()["created"] == 2, r.text

    img, truth = _photo(eid, 40, "123456", "101", 3)
    r = client.post(f"/api/exams/{eid}/submissions", files=[("files", ("a.jpg", img, "image/jpeg"))])
    assert r.status_code == 200, r.text
    sub = r.json()[0]
    assert sub["sbd"] == "123456" and sub["exam_code"] == "101"
    assert sub["student_name"] == "Nguyễn Văn A"
    expected = sum(a == k for a, k in zip(truth.answers, key))
    assert sub["num_correct"] == expected

    full = client.get(f"/api/submissions/{sub['id']}").json()
    assert len(full["omr_detail"]["items"]) == 6 + 3 + 40
    assert client.get(f"/api/submissions/{sub['id']}/image/annotated").status_code == 200

    # sửa tay một câu -> điểm thay đổi, có lịch sử
    answers = full["answers"]
    answers[0] = "A" if answers[0] != "A" else "B"
    r = client.patch(f"/api/submissions/{sub['id']}", json={"answers": answers, "reviewed": True})
    assert r.status_code == 200, r.text
    assert r.json()["num_correct"] != sub["num_correct"]
    assert client.get(f"/api/submissions/{sub['id']}/history").json()[0]["action"] == "edit"

    st = client.get(f"/api/exams/{eid}/stats").json()
    assert st["overview"]["scored"] == 1 and len(st["items"]) == 40
    r = client.get(f"/api/exams/{eid}/export.xlsx")
    assert r.status_code == 200 and len(r.content) > 1000


def test_demo_and_lab(client):
    eid = client.post("/api/exams", json={"name": "Demo", "num_questions": 20}).json()["id"]
    r = client.post(f"/api/exams/{eid}/demo?n=4")
    assert r.status_code == 200, r.text
    subs = client.get(f"/api/exams/{eid}/submissions").json()
    assert len(subs) == 4
    assert all(s["score"] is not None for s in subs)

    img, _ = _photo(eid, 20, "000001", "101", 9)
    r = client.post("/api/lab/analyze", files={"file": ("x.jpg", img, "image/jpeg")})
    body = r.json()
    assert body["ok"], body.get("error")
    assert [s["key"] for s in body["steps"]][-1] == "result"


def test_auth_required():
    with TestClient(app) as c:
        assert c.get("/api/exams").status_code == 401
