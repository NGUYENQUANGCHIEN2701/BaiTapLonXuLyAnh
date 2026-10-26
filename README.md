# OMR Exam — Hệ thống quản lý kỳ thi & chấm bài trắc nghiệm thông minh

Bài tập lớn môn **Xử lý ảnh**. Hệ thống web cho phép giáo viên tạo kỳ thi, in phiếu trả lời, chụp/quét bài làm
(điện thoại, webcam, máy scan, PDF) và **chấm tự động bằng xử lý ảnh (OpenCV)**, kèm duyệt bài nghi vấn, thống kê
và phân tích câu hỏi.

## Tính năng

| Nhóm | Chức năng |
|---|---|
| Kỳ thi | Tạo/sửa/xóa kỳ thi (1–120 câu, 2–6 phương án, thang điểm, điểm đạt), phân quyền admin/giáo viên |
| Phiếu trả lời | Sinh PDF A4 có 4 marker định vị, mã QR (mã kỳ thi + cấu hình), khối SBD 6 số, mã đề 3 số; in phiếu **cá nhân hóa** (in sẵn tên, tô sẵn SBD) |
| Đáp án | Nhiều mã đề; nhập tay (phím tắt), dán chuỗi, Excel/CSV, hoặc **chụp phiếu đáp án** do giáo viên tô |
| Thí sinh | Nhập Excel/CSV, tự ghép bài làm theo SBD, phát hiện SBD lạ / trùng SBD |
| Chấm bài | Tải nhiều ảnh/PDF cùng lúc (hàng đợi song song), **webcam tự chụp** khi phát hiện phiếu |
| Duyệt bài | Ảnh phiếu đã nắn + lớp phủ **bấm trực tiếp vào ô** để sửa; cờ tô nhiều ô / tô mờ / vết tẩy; lịch sử chỉnh sửa (phúc tra); phím tắt |
| Thống kê | Phổ điểm, theo lớp, theo mã đề, top thí sinh, **độ khó p**, **độ phân biệt D (nhóm 27%)**, phân bố phương án nhiễu |
| Xuất | Excel: bảng điểm, chi tiết bài làm, phân tích câu hỏi |
| Phòng thí nghiệm XLA | Hiển thị **từng bước** pipeline trên ảnh bất kỳ (phục vụ báo cáo/thuyết trình) |

## Cài đặt & chạy

Yêu cầu: Python 3.10+ (đã thử 3.12), Node.js 18+ (chỉ cần khi build lại giao diện).

```bash
pip install -r requirements.txt
cd frontend && npm install && npm run build && cd ..     # build giao diện (1 lần)
python run.py                                            # mở http://127.0.0.1:8000
```

Đăng nhập mặc định: `admin` / `admin123`.

Tạo nhanh dữ liệu demo (2 kỳ thi, 75 bài đã chấm, có sẵn các ca cần duyệt):

```bash
python -m tools.seed_demo
```

Phát triển giao diện với hot-reload: chạy `python run.py --reload` và `cd frontend && npm run dev` (mở cổng 5173).
Cho điện thoại trong cùng mạng LAN truy cập: `python run.py --host 0.0.0.0` (camera trình duyệt chỉ chạy trên
`localhost`/HTTPS — trên điện thoại dùng nút *Tải ảnh lên*, trình duyệt sẽ cho chụp trực tiếp).

## Cấu trúc thư mục

```
omr/                    Lõi xử lý ảnh (độc lập với web)
  layout.py             Bố cục phiếu: tọa độ mm của marker, ô SBD, mã đề, câu hỏi — dùng chung khi IN và khi ĐỌC
  sheet_pdf.py          Sinh phiếu PDF (reportlab) + mã QR
  preprocess.py         Ảnh xám, ước lượng nền (phép đóng), chuẩn hóa độ sáng, nhị phân Otsu
  alignment.py          Tìm marker, chọn bộ 4 điểm + kiểm chứng hình mẫu, homography, dự phòng theo mép giấy
  reader.py             Căn chỉnh tinh từng khối, đo độ sáng ô, ngưỡng "bước nhảy lớn nhất", gắn cờ
  pipeline.py           Ghép các bước, đọc QR, diễn giải SBD/mã đề/đáp án, tính điểm
  visualize.py          Vẽ ảnh kết quả chấm
  synth.py              Sinh dữ liệu tổng hợp: tô phiếu + mô phỏng ảnh chụp điện thoại
app/                    Backend FastAPI + SQLAlchemy (SQLite)
  routers/              auth, exams (đáp án, thí sinh, in phiếu, thống kê, xuất), submissions, lab, dashboard
  services/             grading (chấm & trạng thái), stats (item analysis), excel (nhập/xuất)
frontend/               React 19 + Vite + Tailwind CSS 4 + TanStack Query + Recharts
tools/
  evaluate.py           Sinh bộ dữ liệu & đo độ chính xác
  omrchecker_baseline.py  So sánh với OMRChecker trên cùng bộ dữ liệu
  seed_demo.py          Dữ liệu demo
tests/                  Kiểm thử API toàn luồng (pytest)
reference/OMRChecker    Repo tham khảo (MIT)
```

## Pipeline xử lý ảnh

```
Ảnh → xám → chuẩn hóa sáng → nhị phân → contour → lọc marker → chọn 4 điểm + kiểm chứng → homography
    → ảnh chuẩn 6 px/mm → đọc QR → căn chỉnh tinh từng khối → đo độ sáng ô → ngưỡng → diễn giải + gắn cờ
```

1. **Chuẩn hóa độ sáng** — ước lượng nền giấy bằng phép **đóng hình thái học** (giãn rồi co) với phần tử cấu trúc
   lớn hơn mọi nét mực, sau đó `I' = I / nền × 255`. Loại bỏ bóng đổ và ánh sáng không đều.
2. **Nhị phân** — Otsu trên ảnh đã chuẩn hóa (ngưỡng kẹp trong [60, 150]), mở hình thái 2×2 khử nhiễu.
3. **Tìm marker** — `findContours`; giữ contour gần vuông: tỉ lệ cạnh ≥ 0,6, độ đặc (solidity) ≥ 0,9, và
   **xấp xỉ đa giác 4 đỉnh có diện tích ≈ diện tích contour** (hình vuông ≈ 1, hình tròn ≈ 2r²/πr² = 0,64 → loại
   các ô đã tô).
4. **Chọn bộ 4 marker** — duyệt tổ hợp 4 ứng viên: tứ giác lồi, cạnh đối tương đương, tỉ lệ khung ≈ 188:275,
   kích thước marker so với khung hợp lý; ưu tiên diện tích lớn nhất (marker nằm ngoài cùng). Mỗi bộ được
   **kiểm chứng**: nắn thử về 3 px/mm và tính tương quan chuẩn hóa (TM_CCOEFF_NORMED) với hình mẫu các phần cố
   định của phiếu. Marker góc trên-trái **rỗng ruột** + kiểm chứng ⇒ xác định chiều phiếu (xoay 0/90/180/270°).
5. **Homography** — `getPerspectiveTransform` từ 4 tâm marker sang tọa độ chuẩn, `warpPerspective` về 1260×1782 px.
   Dự phòng: Canny + contour tìm mép tờ giấy khi không thấy marker.
6. **Mã QR** — nắn riêng vùng QR ở 12 px/mm rồi `QRCodeDetector` → biết kỳ thi & số câu của tờ phiếu.
7. **Căn chỉnh tinh từng khối** — template matching giữa ảnh mực và hình vẽ lý thuyết (khung + vòng tròn) của
   từng khối trong phạm vi ±2,5 mm: bù giấy cong/nhăn mà homography 4 điểm không mô hình hóa được.
8. **Đo ô** — độ sáng trung bình trong lõi ô (62% bán kính, bỏ viền in).
9. **Ngưỡng** — kế thừa ý tưởng *get_global_threshold* của OMRChecker: sắp xếp toàn bộ giá trị, tìm **bước nhảy
   lớn nhất** → ngưỡng toàn cục; mỗi câu tinh chỉnh ngưỡng cục bộ nhưng chỉ trong dải ±22% bước nhảy.
10. **Gắn cờ** — giá trị sát ngưỡng (không chắc chắn), ô trống tối bất thường (vết tẩy/tô mờ), tô nhiều ô, bỏ
    trống, SBD/mã đề không hợp lệ, SBD không có trong danh sách, trùng SBD, phiếu của kỳ thi khác.

## Kết quả đánh giá

Bộ dữ liệu tổng hợp 150 ảnh, 120 câu/phiếu, mô phỏng chụp điện thoại (phối cảnh ±6–9%, xoay 90/180/270° ở ~30%
ảnh, bóng đổ, gradient sáng, nhiễu, mờ, JPEG 55–92), có tô nhiều ô (3%/câu), vết tẩy (5%/câu), bỏ trống (4%/câu):

```bash
python -m tools.evaluate --n 150 --questions 120
```

| Chỉ số | Kết quả |
|---|---|
| Căn chỉnh thành công | 100% |
| Đọc đúng SBD / mã đề / mã QR | 100% / 100% / 100% |
| Đọc đúng từng câu | 100% |
| Câu sai mà không bị gắn cờ | 0 |
| Cờ báo nhầm (câu đúng bị gắn cờ) | 0% |
| Vết tẩy được gắn cờ để duyệt | 74,6% (số còn lại là vết rất nhạt, vẫn đọc đúng là trống) |
| Thời gian | ~150 ms/phiếu (CPU) |

**So sánh với OMRChecker** (cùng 104 ảnh không xoay; template OMRChecker được sinh tự động từ `omr/layout.py`,
tiền xử lý CropOnMarkers, `sheetToMarkerWidthRatio` đã dò tốt nhất = 21):

```bash
python -m tools.omrchecker_baseline
```

| Chỉ số | OMRChecker | Hệ thống này |
|---|---|---|
| Xử lý được ảnh | 72,1% | 100% |
| Đọc đúng từng câu (trên ảnh xử lý được) | 94,5% | 100% |
| Phiếu đúng hoàn toàn | 57,7% | 100% |

Lưu ý khi trình bày: dữ liệu là tổng hợp và phiếu được thiết kế cho hệ thống này; OMRChecker là công cụ tổng quát
(không tự xoay, không chuẩn hóa sáng, không kiểm chứng marker). Nên bổ sung **ảnh chụp thật**: in phiếu, tô, chụp,
đặt vào `dataset/real/` kèm `truth.json` cùng định dạng rồi chạy `python -m tools.evaluate --eval-only --out dataset/real`.

## Kiểm thử

```bash
python -m pytest tests -q
```

## Tham khảo

- Udayraj123/OMRChecker (MIT) — ý tưởng ngưỡng "bước nhảy lớn nhất" toàn cục/cục bộ, CropOnMarkers, định dạng
  template; dùng làm mốc so sánh.
- R. L. Ebel (1972) — thang đánh giá độ phân biệt câu hỏi.
- N. Otsu (1979) — A threshold selection method from gray-level histograms.
- OpenCV: findContours, approxPolyDP, getPerspectiveTransform, warpPerspective, matchTemplate, QRCodeDetector.
