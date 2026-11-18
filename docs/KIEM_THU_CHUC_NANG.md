# Tài liệu kiểm thử chức năng và đối chiếu mã nguồn — OMR Exam

Ngày lập: **11/11/2026**. Phạm vi: mã nguồn trong dự án tại thời điểm lập tài liệu.

Tài liệu hướng dẫn kiểm thử từng chức năng, chỉ ra API và hàm xử lý tương ứng, đồng thời giải thích cách chọn dữ liệu và kết quả mong đợi. Đây là **kế hoạch kiểm thử**, không phải biên bản xác nhận toàn bộ hệ thống đã đạt.

## 1. Cách sử dụng tài liệu

1. Khởi động môi trường kiểm thử riêng theo mục 2.
2. Chuẩn bị bộ dữ liệu có kết quả biết trước theo mục 3.
3. Chạy luồng chính ở mục 4 trước; sau đó thực hiện các ca chi tiết ở mục 6–17.
4. Dùng bảng đối chiếu ở mục 5 để tìm đúng phần code khi kết quả khác mong đợi.
5. Ghi kết quả theo mẫu ở mục 20; chạy lại các chức năng phụ thuộc sau khi sửa lỗi.

Quy ước:

| Ký hiệu | Ý nghĩa |
|---|---|
| P0 | Chức năng cốt lõi: đăng nhập, phân quyền, đọc bài, tính điểm, lưu và khôi phục kết quả |
| P1 | Chức năng nghiệp vụ còn lại, nhập/xuất và xử lý dữ liệu bất thường |
| P2 | Trải nghiệm giao diện, tính tiện dụng, đánh giá hiệu năng |
| E | ID kỳ thi do hệ thống tự sinh sau khi tạo; xem “mã kỳ thi #…” hoặc số trong URL `/exams/…`; không phải trường nhập trên form |
| S | ID bài làm trong URL `/submissions/…` khi mở chi tiết bài; khác với SBD của thí sinh |
| UI | Thực hiện qua giao diện trình duyệt |
| API | Gửi yêu cầu bằng `/docs`, Postman hoặc PowerShell; kiểm tra cả HTTP status và nội dung phản hồi |
| Hồi quy | Chạy lại sau thay đổi code hoặc dữ liệu nghiệp vụ có liên quan |

Mỗi dòng trong bảng ca test có thể gồm vài biến thể. Chạy từng biến thể trên dữ liệu độc lập và ghi riêng kết quả nếu có khác biệt. Nếu ghi “hành vi hiện tại”, đó là điều đọc được từ code; các yêu cầu cải thiện được tách ở mục 18.

## 2. Chuẩn bị môi trường kiểm thử

### 2.1. Cài đặt và chạy trên Windows PowerShell

Yêu cầu theo dự án: Python 3.10+; Node.js 18+ khi cần build giao diện. Mở PowerShell ở thư mục gốc dự án.

```powershell
Set-Location D:\BTLXuLyAnh
python --version
node --version
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt

# Thư mục mới cho mỗi đợt kiểm thử, tránh ảnh hưởng data/app.db đang dùng.
$testDataDir = Join-Path (Get-Location) ("data\manual_" + (Get-Date -Format "yyyyMMdd_HHmmss"))
$env:OMR_DATA_DIR = $testDataDir
# Nếu đang đặt URL CSDL riêng, bỏ biến đó trong phiên terminal kiểm thử này.
Remove-Item Env:OMR_DATABASE_URL -ErrorAction SilentlyContinue

Push-Location frontend
npm ci
npm run build
Pop-Location

.\.venv\Scripts\python.exe run.py
```

Mở `http://127.0.0.1:8000`, API tương tác tại `http://127.0.0.1:8000/docs`. Admin mặc định là `admin` / `admin123` nếu không thay `OMR_ADMIN_USER`, `OMR_ADMIN_PASSWORD`. Tài khoản chỉ được tạo khi bảng người dùng đang trống; đổi biến môi trường không đặt lại mật khẩu tài khoản đã tồn tại.

Nếu `python` không có trong PATH, dùng đường dẫn tới `python.exe` đã cài hoặc `py -3` nếu máy có Python Launcher. Sau khi tạo `.venv`, các lệnh bên dưới dùng trực tiếp `.venv\Scripts\python.exe`, không cần kích hoạt môi trường ảo.

**Dữ liệu lưu ở đâu:** `app/config.py` đọc `OMR_DATA_DIR` để đặt CSDL, ảnh tải lên và khóa phiên; `OMR_DATABASE_URL` có thể ghi đè riêng vị trí CSDL. Phải đặt biến môi trường **trước khi** chạy server hoặc import `app`. Khi mở terminal khác để seed dữ liệu, phải đặt cùng giá trị `OMR_DATA_DIR`; không chạy seed vào nhầm CSDL.

### 2.2. Công cụ và tài khoản

| Thành phần | Chuẩn bị | Mục đích |
|---|---|---|
| Trình duyệt | Chrome hoặc Edge, DevTools → Network, bật giữ log khi cần | Xem request, cookie và lỗi UI |
| API client | Swagger `/docs` hoặc Postman, giữ cookie `omr_session` | Test dữ liệu mà UI không cho nhập; test quyền trực tiếp |
| Tài khoản | `admin`, `gv_test_a`, `gv_test_b`; mật khẩu giáo viên ví dụ `Test123456` | Hai giáo viên tạo hai kỳ thi riêng để kiểm tra quyền sở hữu |
| Phiếu thật | Máy in A4, bút chì, điện thoại hoặc scanner | Xác minh độ chính xác trên giấy thực tế |
| Webcam | Quyền camera, mở bằng localhost hoặc HTTPS | Test chụp tay và tự động |
| Excel/PDF viewer | Mở file tải xuống và kiểm tra nội dung | Không chỉ kiểm tra tải file thành công |

Trong Postman, gửi `POST /api/auth/login` với JSON trước rồi giữ cookie tự động cho các request sau. Dùng cookie jar hoặc phiên trình duyệt riêng cho từng vai trò; không dùng chung phiên admin khi test giáo viên.

### 2.3. Dữ liệu demo để khám phá nhanh

Ở một terminal khác đã đặt đúng `OMR_DATA_DIR`, có thể chạy:

```powershell
.\.venv\Scripts\python.exe -m tools.seed_demo
```

Hoặc tạo một kỳ thi riêng rồi dùng nút sinh demo trong tab Tổng quan (`POST /api/exams/E/demo?n=10`). Seed toàn hệ thống tạo hai kỳ thi và gọi sinh 45 + 30 bài; tài khoản demo là `giaovien` / `123456`. Script tạo kỳ thi bằng phiên admin nên các kỳ thi đó thuộc admin, không mặc định thuộc tài khoản `giaovien`.

Dữ liệu demo phù hợp để xem luồng và trình bày. **Không dùng điểm demo ngẫu nhiên làm chuẩn tính điểm**; dùng bộ dữ liệu cố định dưới đây. Không yêu cầu mỗi lần bấm demo phải sinh đủ `n` bài: endpoint bỏ qua thí sinh đã có bài và có thể trả `created` nhỏ hơn `n`.

## 3. Bộ dữ liệu chuẩn và phép tính đối chiếu

### 3.1. Kỳ thi và đáp án

Tạo kỳ thi `TEST_OMR_10`, môn `Xử lý ảnh`, **10 câu, 4 phương án, thang 10, điểm đạt 5**. Đổi số câu mặc định 40 thành **10** trước khi bấm Tạo kỳ thi. Form không có ô ID; sau khi tạo, xem “mã kỳ thi #…” dưới tên kỳ thi hoặc số trong URL (ví dụ `/exams/3` thì E = 3). Tạo mã đề `101` với đáp án:

```text
Câu:     01 02 03 04 05 06 07 08 09 10
Đáp án:   A  B  C  D  A  B  C  D  A  B
Chuỗi:   ABCDABCDAB
```

Tạo thêm kỳ thi `TEST_OMR_OTHER` để thử phiếu sai kỳ thi; các ca lỗi hoặc thay đổi đáp án dùng kỳ thi riêng có cấu hình giống E để giữ nguyên bộ chuẩn thống kê.

### 3.2. Danh sách thí sinh

Lưu nội dung dưới dạng CSV UTF-8, ví dụ `students_test.csv`; hoặc điền tương tự vào file mẫu Excel tải từ hệ thống:

```csv
SBD,Họ tên,Lớp,Phòng thi
000001,Nguyễn Test Một,12A1,P101
000002,Trần Test Hai,12A1,P101
000003,Lê Test Ba,12A2,P102
000004,Phạm Test Bốn,12A2,P102
000005,Vũ Test Vắng,12A2,P102
```

### 3.3. Bốn phiếu biết trước kết quả

In hoặc tạo bốn phiếu của **đúng E**, tô SBD và mã đề `101`, rồi tô như bảng. Chỉ tải **một ảnh của mỗi thí sinh** vào bộ chuẩn; tải cả ảnh sạch lẫn ảnh chụp sẽ tạo bài trùng.

| Phiếu | SBD | Chuỗi bài làm | Đúng | Điểm | Kết quả |
|---|---|---|---:|---:|---|
| A | 000001 | `ABCDABCDAB` | 10/10 | 10,00 | Đạt |
| B | 000002 | `ABCDABCDCC` | 8/10 | 8,00 | Đạt |
| C | 000003 | `ABCDACDABC` | 5/10 | 5,00 | Đạt, đúng ngay ngưỡng |
| D | 000004 | `BCDABCDABC` | 0/10 | 0,00 | Chưa đạt |
| Vắng | 000005 | Không nộp | — | Không có điểm | Vắng / chưa nộp |

Công thức code tại `omr/pipeline.py::score_answers()`:

```python
ok = bool(k) and a == k
score = round(max_score * correct / len(key), 2) if key else 0.0
```

Một câu được tính đúng khi đáp án chuẩn có giá trị và bài làm khớp hoàn toàn. Bỏ trống hoặc tô nhiều ô tính sai. Câu chưa có đáp án vẫn nằm trong mẫu số nên không tự tăng điểm các câu khác.

Sau khi chỉ có bốn bài A–D, các giá trị chuẩn là:

| Đại lượng | Giá trị mong đợi |
|---|---|
| Bài làm / có điểm / thí sinh / vắng | 4 / 4 / 5 / 1 |
| Tổng điểm / trung bình / trung vị | 23 / 5,75 / 6,50 |
| Min / max / độ lệch chuẩn tổng thể | 0 / 10 / 3,77 |
| Tỉ lệ đạt | 3/4 = 75% |
| Lớp 12A1 | 2 bài, trung bình 9,00, đạt 100% |
| Lớp 12A2 | 2 bài có điểm, trung bình 2,50, đạt 50%; 1 thí sinh vắng |
| Phổ điểm | Khoảng 0–1, 5–6, 8–9, 9–10 mỗi khoảng 1 bài; các khoảng khác 0 |
| Câu 1 mã đề 101 | A: 3; B: 1; C/D: 0; `p = 0.75`, nhãn Dễ; `D = 1.0`, nhãn Rất tốt |

Độ phân biệt câu 1: có 4 bài nên mỗi nhóm lấy `max(1, round(4 × 0.27)) = 1` bài; nhóm cao nhất làm đúng và nhóm thấp nhất làm sai, do đó `D = 1 − 0 = 1`.

### 3.4. Sinh ảnh kiểm thử có nhãn bằng mã nguồn hiện có (tùy chọn)

Sau khi tạo E, dùng [tools/generate_manual.py](../tools/generate_manual.py) để tránh lỗi khi dán nhiều dòng vào PowerShell. Với E = 3, chạy từng lệnh dưới đây; nếu E khác, thay số 3 bằng ID thực tế:

```powershell
cd D:\BTLXuLyAnh
python -m tools.generate_manual --exam-id 3
explorer D:\BTLXuLyAnh\dataset\manual_3
```

Dùng cùng Python/môi trường đang chạy hệ thống; nếu đã tạo `.venv`, có thể dùng `.\.venv\Scripts\python.exe -m tools.generate_manual --exam-id 3`. Script chỉ tạo file, không sửa CSDL hoặc tự nộp bài; in đường dẫn tuyệt đối và tiến độ từng ảnh. Đầu ra mặc định luôn nằm trong `dataset/manual_<E>/` của dự án. Chạy lại sẽ thay các file sinh cùng tên; dùng `--out dataset/manual_3_lan2` nếu muốn giữ bộ cũ.

Nếu terminal chỉ quay về prompt mà không báo tiến độ: kiểm tra lệnh có bị gộp vào sau dấu `#` không. PowerShell xem phần sau `#` trên cùng dòng là chú thích, nên đoạn Python có thể chưa từng được chạy. Nếu báo `Missing Python dependency`, cài `requirements.txt` bằng đúng Python được chỉ ra trong thông báo rồi chạy lại.

Tải bốn file `000001.jpg`–`000004.jpg` để test bộ chuẩn. Dùng `four_pages.pdf` trên **kỳ thi thử riêng có cùng ID phiếu phù hợp**, hoặc xóa bài thử trước khi đổi cách nộp trong cùng kỳ thi, để tránh làm sai thống kê do trùng bài. Khi thử PDF ở kỳ thi khác với E, sẽ có cờ sai kỳ thi; cách dễ nhất là tạo bộ ảnh mới cho ID kỳ thi dùng riêng để thử PDF.

Luôn kiểm tra ảnh và nhãn trước khi dùng làm chuẩn; ảnh tổng hợp không thay thế phiếu in và chụp thật. Trạng thái xác minh script được ghi tại mục 20.3.

## 4. Luồng kiểm thử chính khoảng 15–20 phút

| Bước | Thực hiện | Điều kiện đạt |
|---:|---|---|
| 1 | Đăng nhập admin; tạo hai giáo viên test | Đăng nhập được; danh sách người dùng không chứa mật khẩu/hash |
| 2 | Đăng nhập `gv_test_a`, tạo E theo mục 3 | Hiển thị đúng cấu hình; E thuộc giáo viên A |
| 3 | Lưu đáp án 101, nhập 5 thí sinh | 1 mã đề, 5 SBD đủ 6 chữ số, tên tiếng Việt đúng |
| 4 | Mở tab In phiếu; xem phiếu trắng và cá nhân hóa | Đúng số câu/phương án; cá nhân hóa có 5 trang, tên và SBD tương ứng |
| 5 | Nộp bốn ảnh A–D, mỗi ảnh một lần | Đọc đúng SBD, mã đề, chuỗi; điểm 10, 8, 5, 0 |
| 6 | Mở thống kê và xuất Excel | Đối chiếu toàn bộ các giá trị ở mục 3.3 |
| 7 | Trên kỳ thi thử riêng, nộp phiếu tô hai ô | Có cờ `multiple`, bài `review`; câu đó không được tính đúng |
| 8 | Sửa câu sai thành đúng, lưu, xem lịch sử; sau đó khôi phục | Điểm thay đổi đúng một câu; lịch sử có trước/sau; reset về kết quả máy |
| 9 | Đăng nhập `gv_test_b`, gọi API đọc E và ảnh bài làm của E | HTTP 403; không lộ dữ liệu |
| 10 | Đăng xuất, tải lại URL được bảo vệ | UI về đăng nhập; API yêu cầu xác thực trả 401 |

Nếu không có webcam hoặc máy in, ghi các ca tương ứng **Blocked**, không ghi Pass.

## 5. Bản đồ chức năng → giao diện → code xử lý

Các liên kết tương đối mở file trong repository. Số dòng là điểm bắt đầu hàm tại thời điểm lập tài liệu; nếu code đổi, tìm theo tên hàm. Mỗi ca test bên dưới ghi mã tham chiếu Mxx để tra phần code này.

| Mã | Chức năng và giao diện | Code backend / lõi cần đọc |
|---|---|---|
| M01 | Đăng nhập: [Login.tsx](../frontend/src/pages/Login.tsx), [auth.tsx](../frontend/src/lib/auth.tsx), [App.tsx](../frontend/src/App.tsx) `RequireAuth` (dòng 21) | [auth.py](../app/routers/auth.py): `login` (15), `logout` (24), `me` (30); [security.py](../app/security.py): `make_token` (44), `read_token` (50), `current_user` (64) |
| M02 | Đổi mật khẩu: [Layout.tsx](../frontend/src/components/Layout.tsx) `PasswordModal` (48) | [auth.py](../app/routers/auth.py): `change_password` (35); [security.py](../app/security.py): `hash_password` (21), `verify_password` (27); [schemas.py](../app/schemas.py): `PasswordChange` |
| M03 | Quản lý tài khoản: [Users.tsx](../frontend/src/pages/Users.tsx) | [auth.py](../app/routers/auth.py): `list_users` (44), `create_user` (49), `delete_user` (59); [security.py](../app/security.py): `require_admin` (75) |
| M04 | Tạo, xem, sửa, xóa kỳ thi: [Exams.tsx](../frontend/src/pages/Exams.tsx), [ExamForm.tsx](../frontend/src/components/ExamForm.tsx), [Overview.tsx](../frontend/src/pages/exam/Overview.tsx) | [exams.py](../app/routers/exams.py): `list_exams` (50), `create_exam` (58), `get_exam` (68), `update_exam` (73), `delete_exam` (88); [schemas.py](../app/schemas.py): `ExamBase`, `ExamUpdate` |
| M05 | Quyền sở hữu kỳ thi và mọi tài nguyên con | [security.py](../app/security.py): `get_exam_for` (81); [submissions.py](../app/routers/submissions.py): `_get_sub` (38); [dashboard.py](../app/routers/dashboard.py): lọc theo `owner_id` |
| M06 | Phiếu trắng, xem trước, cá nhân hóa: [Sheets.tsx](../frontend/src/pages/exam/Sheets.tsx) | [exams.py](../app/routers/exams.py): `_sheet_infos` (98), `sheet_pdf` (110), `sheet_png` (122); [sheet_pdf.py](../omr/sheet_pdf.py): `_markers` (88), `_digit_block` (105), `_qr` (127), `draw_sheet` (229), `render_pdf` (253), `render_png` (266); [layout.py](../omr/layout.py): `build_layout` (130), `encode_qr` (172) |
| M07 | Đáp án nhập tay, phím tắt, dán chuỗi: [Keys.tsx](../frontend/src/pages/exam/Keys.tsx) `AnswerGrid` (11), `KeyEditor` (112) | [exams.py](../app/routers/exams.py): `_check_key` (130), `list_keys` (140), `upsert_key` (145), `delete_key` (160); [schemas.py](../app/schemas.py): `_norm_answers`, `KeyIn`; [grading.py](../app/services/grading.py): `refresh_exam` (142) |
| M08 | Đáp án từ Excel/CSV/ảnh: [Keys.tsx](../frontend/src/pages/exam/Keys.tsx) `importFile`, `fromSheet` | [exams.py](../app/routers/exams.py): `import_keys` (172), `key_from_sheet` (190), `keys_template` (204); [excel.py](../app/services/excel.py): `read_table` (26), `parse_keys` (82), `key_template` (148); [grading.py](../app/services/grading.py): `answers_from_sheet` (192) |
| M09 | Thí sinh, tìm kiếm, lọc lớp: [Students.tsx](../frontend/src/pages/exam/Students.tsx) | [exams.py](../app/routers/exams.py): `list_students` (212), `create_student` (226), `update_student` (238), `delete_student` (255), `import_students` (267), `students_template` (295); [excel.py](../app/services/excel.py): `parse_students` (55), `student_template` (134); [schemas.py](../app/schemas.py): `StudentIn` |
| M10 | Nộp ảnh/PDF và hàng đợi: [Grade.tsx](../frontend/src/pages/exam/Grade.tsx) `UploadMode` (26), `pump`, `clearFinished`; [api.ts](../frontend/src/lib/api.ts) `upload` | [submissions.py](../app/routers/submissions.py): `MAX_UPLOAD`, `upload` (47); [pipeline.py](../omr/pipeline.py): `load_image_bytes` (211); [grading.py](../app/services/grading.py): `grade_image` (153) |
| M11 | Webcam: [Grade.tsx](../frontend/src/pages/exam/Grade.tsx) `WebcamMode` (151), `start`, `capture`, vòng lặp phát hiện | [lab.py](../app/routers/lab.py): `detect` (153); [alignment.py](../omr/alignment.py): `align` (236); nộp ảnh dùng cùng API ở M10 |
| M12 | Đọc ô, cờ, tính điểm, ghép thí sinh, trạng thái | [pipeline.py](../omr/pipeline.py): `_decode_digits` (88), `process_image` (111), `score_answers` (196); [grading.py](../app/services/grading.py): `key_for` (86), `evaluate` (90), `refresh_exam` (142), `grade_image` (153) |
| M13 | Danh sách, chi tiết, ảnh bài làm: [Results.tsx](../frontend/src/pages/exam/Results.tsx), [Review.tsx](../frontend/src/pages/Review.tsx) | [submissions.py](../app/routers/submissions.py): `list_submissions` (70), `get_submission` (84), `neighbors` (89), `image` (180) |
| M14 | Sửa, duyệt, reset, xóa, lịch sử: [Review.tsx](../frontend/src/pages/Review.tsx) `SheetOverlay` (25), `HistoryModal` (136), `ReviewBody` (165) | [submissions.py](../app/routers/submissions.py): `patch_submission` (102), `reset_submission` (142), `delete_submission` (155), `history` (172); [grading.py](../app/services/grading.py): `evaluate` (90); [visualize.py](../omr/visualize.py): `annotate` (28) |
| M15 | Thống kê: [Stats.tsx](../frontend/src/pages/exam/Stats.tsx); tổng quan: [Dashboard.tsx](../frontend/src/pages/Dashboard.tsx), [Overview.tsx](../frontend/src/pages/exam/Overview.tsx) | [stats.py](../app/services/stats.py): `exam_stats` (32), `_difficulty_label` (13), `_discrimination_label` (21); [exams.py](../app/routers/exams.py): `_summary` (34), `stats` (303), `activity` (318); [dashboard.py](../app/routers/dashboard.py): `dashboard` (13) |
| M16 | Xuất Excel: [ExamLayout.tsx](../frontend/src/pages/exam/ExamLayout.tsx), nút Xuất Excel | [exams.py](../app/routers/exams.py): `export` (308), `_download` (29); [excel.py](../app/services/excel.py): `export_results` (162) |
| M17 | Phòng thí nghiệm: [Lab.tsx](../frontend/src/pages/Lab.tsx) `Lab` (36), `ThresholdChart` (10) | [lab.py](../app/routers/lab.py): `analyze` (64), `sample` (142), `_value_heatmap` (37), `_alignment_view` (50) |
| M18 | Sinh dữ liệu và đánh giá OMR | [lab.py](../app/routers/lab.py): `demo_data` (168); [seed_demo.py](../tools/seed_demo.py): `main`; [synth.py](../omr/synth.py): `render_blank` (29), `fill_sheet` (60), `photograph` (105); [evaluate.py](../tools/evaluate.py): `generate` (23), `evaluate` (40) |
| M19 | Các bước xử lý ảnh để kiểm tra độc lập | [preprocess.py](../omr/preprocess.py): `to_gray`, `estimate_background`, `normalize_illumination`, `binarize_dark`; [alignment.py](../omr/alignment.py): `find_marker_candidates`, `marker_quads`, `select_markers`, `find_page_quad`, `align`, `warp`; [reader.py](../omr/reader.py): `align_block`, `find_jump_threshold`, `read_bubbles` |
| M20 | Khởi động, CSDL, giao diện SPA, xử lý phiên và lỗi | [main.py](../app/main.py): `init_db`, `health`, `spa`; [db.py](../app/db.py); [config.py](../app/config.py); [models.py](../app/models.py); [api.ts](../frontend/src/lib/api.ts), [auth.tsx](../frontend/src/lib/auth.tsx) |

## 6. Đăng nhập, phiên làm việc và người dùng

| ID / mức | Chức năng, code | Bước thực hiện và dữ liệu | Kết quả mong đợi |
|---|---|---|---|
| AUTH-01 / P0 | Đăng nhập, M01 | Mở `/login`; nhập admin đúng; tải lại trang; gọi `GET /api/auth/me` | Login 200, đúng tài khoản/vai trò; có cookie `omr_session`, HttpOnly; tải lại vẫn đăng nhập |
| AUTH-02 / P0 | Sai thông tin, M01 | Thử sai mật khẩu và username không tồn tại trong phiên chưa đăng nhập | HTTP 401, thông báo sai tên/mật khẩu; không tạo phiên hợp lệ |
| AUTH-03 / P0 | Chưa đăng nhập, M01/M05 | Cửa sổ riêng không cookie: mở `/exams`; gọi `/api/exams`, `/api/dashboard`, `/api/users`, API ảnh bài làm | UI chuyển `/login`; API được bảo vệ trả 401; `/api/health` vẫn 200 |
| AUTH-04 / P0 | Đăng xuất, M01 | Đăng nhập → đăng xuất → gọi lại `/api/auth/me`, tải lại trang được bảo vệ | Cookie bị xóa trong client; `/me` trả 401, UI yêu cầu đăng nhập |
| AUTH-05 / P1 | Phiên không hợp lệ, M01 | Sửa một ký tự chữ ký cookie; thử token hết hạn được tạo trong môi trường test với chữ ký hợp lệ | HTTP 401; không được đọc dữ liệu. Không cần chờ 7 ngày; token test phải được tạo ở môi trường kiểm thử |
| AUTH-06 / P1 | Đổi mật khẩu, M02 | Với tài khoản giáo viên test: nhập mật khẩu cũ sai; mới dưới 6 ký tự; sau đó đổi đúng và đăng xuất | Cũ sai: 400; mới ngắn qua API: 422; đổi đúng: 200; mật khẩu cũ không đăng nhập được, mới đăng nhập được |
| USER-01 / P1 | Tạo tài khoản, M03 | Admin tạo `gv_test_a`, vai trò teacher, mật khẩu hợp lệ; tạo thêm tài khoản admin thử | HTTP 200, trả đúng role; tài khoản mới đăng nhập được; phản hồi không có `password_hash` |
| USER-02 / P1 | Validation, M03 | Tạo username trùng; username 2 ký tự; mật khẩu 5 ký tự; role `student` qua API | Trùng: 400; các trường vi phạm schema: 422; không sinh tài khoản không hợp lệ |
| USER-03 / P0 | Quyền admin, M03 | Giáo viên gọi trực tiếp GET/POST `/api/users`, DELETE `/api/users/{id}` | Cả ba bị 403; UI không có mục Người dùng; truy cập URL trực tiếp không được xem danh sách |
| USER-04 / P1 | Xóa tài khoản, M03/M20 | Admin xóa giáo viên thử có kỳ thi; sau đó thử xóa chính admin đang đăng nhập và ID không tồn tại | Giáo viên bị xóa; cookie của họ không còn xác thực; kỳ thi còn và admin truy cập được; tự xóa: 400; không tồn tại: 404 |

## 7. Kỳ thi và phân quyền dữ liệu

| ID / mức | Chức năng, code | Bước thực hiện và dữ liệu | Kết quả mong đợi |
|---|---|---|---|
| EXAM-01 / P0 | Tạo/xem/tìm, M04 | Giáo viên A tạo E, tải lại; tìm theo một phần tên/môn, thử từ khóa không khớp | HTTP 200; cấu hình giữ nguyên; chủ sở hữu là A; tìm đúng danh sách, có trạng thái không có kết quả |
| EXAM-02 / P1 | Biên cấu hình, M04 | Qua API tạo các biến thể: câu 1,120 hợp lệ; 0,121 lỗi; phương án 2,6 hợp lệ; 1,7 lỗi; max_score 0; pass_score âm; tên rỗng, tên 201 ký tự | Giá trị hợp lệ tạo được; vi phạm `ExamBase` trả 422. Tách từng trường lỗi để xác định nguyên nhân |
| EXAM-03 / P1 | Sửa trước khi có bài, M04/M07 | Kỳ thi thử mới: đổi tên, môn, ngày, số câu, số phương án; mở lại đáp án và phiếu | Lưu được, dữ liệu trả về đúng; phiếu cập nhật. Đáp án cũ không được mặc nhiên xem là phù hợp cấu hình mới; kiểm tra lại nội dung |
| EXAM-04 / P0 | Khóa cấu hình sau nộp, M04 | Kỳ thi đã có bài: thử đổi số câu/phương án qua UI và PUT; thử PUT lại đúng số cũ | UI khóa trường; đổi giá trị qua API trả 400; gửi lại giá trị đang có được chấp nhận |
| EXAM-05 / P0 | Đổi thang và điểm đạt, M04/M12/M15 | Trên bản thử có điểm như mục 3, đổi max_score 10→20, pass_score 5→10; kiểm tra bài, thống kê, Excel | Điểm thành 20,16,10,0; tỉ lệ đạt vẫn 75%; ảnh và kết quả cập nhật qua `refresh_exam` |
| ACL-01 / P0 | Tách dữ liệu hai giáo viên, M05 | A và B có kỳ thi riêng. B gọi GET/PUT/DELETE `/api/exams/E`, `/keys`, `/students`, `/stats`, `/export.xlsx`, `/activity`, `/sheet.pdf`, POST nộp bài và demo của A | Danh sách B chỉ có kỳ thi B; mọi thao tác với E của A bị 403; không sửa/xóa dữ liệu A. Dùng bản thử khi kiểm tra DELETE |
| ACL-02 / P0 | Quyền trên bài và ảnh, M05/M13/M14 | B gọi GET chi tiết, neighbors, history, image/original, image/warped, image/annotated, PATCH, reset, DELETE của S thuộc A | Tất cả bị 403; không lộ ảnh hoặc lịch sử. Admin được phép với cùng tài nguyên |
| EXAM-06 / P1 | ID không tồn tại, M04/M13 | Gọi kỳ thi/bài làm với ID số chắc chắn chưa tồn tại | HTTP 404, thông báo phù hợp, không phát sinh tài nguyên mới |
| EXAM-07 / P1 | Xóa kỳ thi, M04/M20 | Kỳ thi thử có đáp án, thí sinh, bài, ảnh và log: thử Hủy trước, sau đó xác nhận xóa | Hủy giữ nguyên; xác nhận trả 200; kỳ thi và tài nguyên con không còn truy cập được; thư mục uploads của kỳ thi được dọn |

## 8. Sinh và in phiếu trả lời

| ID / mức | Chức năng, code | Bước thực hiện và dữ liệu | Kết quả mong đợi |
|---|---|---|---|
| SHEET-01 / P0 | Phiếu trắng/xem trước, M06 | Với E, mở In phiếu; tải PNG và `sheet.pdf` | PNG/PDF đúng kiểu file; A4 dọc, 10 câu A–D, SBD 6 cột, mã đề 3 cột, 4 marker và QR; không chồng chữ/ô |
| SHEET-02 / P1 | Số bản, M06 | Gọi `sheet.pdf?copies=1`, `copies=3`; API thử 0,501 | Số trang tương ứng 1,3; ngoài 1–500 trả 422. Chỉ thử 500 khi cần kiểm tra tải lớn |
| SHEET-03 / P0 | Cá nhân hóa, M06/M09 | Nhập 5 thí sinh; gọi `sheet.pdf?personalized=true`; đối chiếu từng trang | 5 trang, đúng họ tên/lớp/phòng và SBD tô sẵn; thứ tự phòng rồi SBD; không lấy `copies` để nhân số thí sinh |
| SHEET-04 / P1 | Không có thí sinh, M06 | Kỳ thi trống gọi `sheet.pdf?personalized=true` | HTTP 400, báo chưa có danh sách; UI vô hiệu hóa nút tương ứng |
| SHEET-05 / P1 | Biên bố cục, M06/M19 | Tạo cấu hình 1/4, 21/4, 120/6 (số câu/phương án); mở PDF và đọc lại ảnh | Đủ câu, thứ tự không trùng/thiếu, không tràn A4; QR mang đúng cấu hình; đọc đủ số câu, cả lựa chọn E/F với 6 phương án |
| SHEET-06 / P0 | In rồi đọc thật, M06/M12 | In tỷ lệ 100%; tô A, chụp rõ đủ góc, nộp vào đúng E | Đúng SBD, mã đề, 10 câu và điểm 10; lưu ảnh gốc/nắn/chú thích để đối chiếu. Không coi PNG xem trước đúng là bằng chứng bản in được đọc đúng |

## 9. Đáp án theo mã đề

| ID / mức | Chức năng, code | Bước thực hiện và dữ liệu | Kết quả mong đợi |
|---|---|---|---|
| KEY-01 / P0 | Nhập tay/lưu lại, M07 | Nhập `101`, chọn `ABCDABCDAB`; lưu, tải lại; POST cùng mã với một câu thay đổi | Chỉ có 1 bản ghi mã 101; lần sau cập nhật bản cũ; bài liên quan được tính lại điểm |
| KEY-02 / P1 | Chuẩn hóa mã và đáp án, M07 | Qua API gửi code `1`, answers `abcdabcdab`; thử code `A01`, `1234`, đáp án `E` hoặc `AB` cho một câu của kỳ thi 4 phương án | `1` thành `001`, chữ thường thành hoa; code sai: 422; phương án sai/tô nhiều ở đáp án chuẩn: 400 |
| KEY-03 / P1 | Phím tắt và dán chuỗi, M07 | Tập trung vào dòng câu; nhập A–D, ↑/↓, Delete; dán `1A 2B 3C 4D 5A 6B 7C 8D 9A 10B`; thử dấu `-` | Chọn và chuyển dòng đúng; Delete xóa; dán tạo đúng 10 đáp án; `-` biểu diễn câu chưa có đáp án. Kiểm tra trước khi Lưu |
| KEY-04 / P1 | Thiếu/thừa đáp án, M07 | Qua API gửi 8 đáp án rồi 12 đáp án cho kỳ thi 10 câu | Hành vi hiện tại: thiếu được đệm `""`, thừa cắt còn 10, vẫn lưu. Không kỳ vọng 400 chỉ do sai chiều dài; câu khóa trống không được chấm đúng |
| KEY-05 / P1 | File mẫu và hai dạng nhập, M08 | Tải `keys/template.xlsx`; điền đủ câu cho 101,102; nhập. Lặp trên kỳ thi khác bằng CSV dạng `Mã đề,Chuỗi` | Tải đúng file mẫu; `imported`, `codes` đúng; cả dạng cột `Câu,101,102` và dạng hàng đều đọc đúng |
| KEY-06 / P1 | File có lỗi, M08 | Nhập file có một mã không phải số, thiếu một câu, phương án ngoài A–D; thử file trống/hỏng | Lỗi dòng/thiếu câu được thể hiện trong `errors` khi parser xử lý được; phương án sai trả 400; lỗi không được âm thầm biến thành bộ đáp án đầy đủ. File hỏng xem thêm mục 18 |
| KEY-07 / P0 | Đọc phiếu đáp án, M08/M12 | Chụp phiếu đã tô code 101 và chuỗi chuẩn; bấm nhập từ phiếu; trước Lưu gọi GET keys, sau đó bấm Lưu | Kết quả đọc chỉ là bản xem trước, chưa tạo/sửa khóa; sau Lưu mới ghi DB. Có warnings nếu câu mờ/tô nhiều; giáo viên sửa các câu đó trước khi lưu |
| KEY-08 / P1 | Phiếu đáp án không hợp lệ, M08 | Thử ảnh không phải phiếu; phiếu không đọc được mã đề | 400 nếu không căn chỉnh hoặc code không phải số; không tạo đáp án. Phiếu sai kỳ thi cần kiểm tra riêng ở mục 18 |
| KEY-09 / P0 | Nhiều mã đề, xóa khóa, M07/M12 | Tạo 102 khác 101; nộp bài mã tương ứng; Hủy rồi xác nhận xóa 101 | Mỗi bài tra đúng mã đề, không dùng khóa của mã khác; sau xóa, bài 101 có điểm null và cờ thiếu/không có mã đề; bài 102 giữ đúng điểm |

## 10. Quản lý danh sách thí sinh

| ID / mức | Chức năng, code | Bước thực hiện và dữ liệu | Kết quả mong đợi |
|---|---|---|---|
| STU-01 / P1 | Thêm/sửa/xem, M09 | Thêm SBD `1`, tên tiếng Việt; sửa tên, ngày sinh, lớp, phòng; tải lại | SBD lưu `000001`; thông tin giữ đúng; bài có cùng SBD ghép đúng thí sinh |
| STU-02 / P1 | Dữ liệu sai/trùng, M09 | Thêm SBD đã có; sửa thành SBD của người khác; thử `12A`, 7 chữ số, tên rỗng qua API | Trùng: 400; vi phạm schema: 422; không nhân đôi thí sinh trong một kỳ thi |
| STU-03 / P1 | Import CSV/XLSX, M09 | Tải mẫu, nhập 5 người mục 3; thử CSV UTF-8 BOM, dấu phẩy/chấm phẩy/tab; SBD Excel dạng số `1` | Số tạo đúng; tên tiếng Việt đúng; SBD thành 6 chữ số; hàng dữ liệu không bị tính là tiêu đề |
| STU-04 / P1 | Import cập nhật, M09 | Nhập lại cùng 5 SBD với một tên/lớp mới, `replace=false` | `created=0`, `updated=5`; không thêm trùng; bài làm hiển thị tên/lớp mới sau làm mới dữ liệu |
| STU-05 / P1 | Thay danh sách, M09/M12 | Kỳ thi thử có bài: import danh sách mới với `replace=true`, gồm một SBD cũ và một mới | Danh sách cũ bị thay; bài vẫn còn; bài SBD còn trong danh sách được ghép lại; SBD bị loại có `unknown_student` khi danh sách mới không trống |
| STU-06 / P1 | Lỗi từng dòng, M09 | File có 1 dòng hợp lệ, 1 SBD chữ, 1 thiếu tên; file thiếu cột bắt buộc | Dòng hợp lệ vẫn nhập; `errors` mô tả dòng lỗi; thiếu cột trả `errors`, không tạo thí sinh. UI chỉ hiện một số cảnh báo đầu, xem đủ qua API |
| STU-07 / P2 | Tìm/lọc/mở bài, M09 | Tìm bằng SBD/tên, lọc 12A1 rồi 12A2; mở liên kết bài của người đã nộp | Đúng tập kết quả; người vắng không có liên kết bài; người có bài mở đúng S |
| STU-08 / P1 | Xóa và cập nhật liên kết, M09/M12 | Xóa một thí sinh đã có bài trên kỳ thi thử; kiểm tra bài, thống kê, danh sách | Bài không bị xóa; liên kết thí sinh được cập nhật; khi roster còn người khác, bài vừa mất thí sinh có `unknown_student`; chỉ số vắng tính lại |

## 11. Chấm bài từ ảnh, PDF và webcam

### 11.1. Tải file và hàng đợi

| ID / mức | Chức năng, code | Bước thực hiện và dữ liệu | Kết quả mong đợi |
|---|---|---|---|
| UP-01 / P0 | Một ảnh hợp lệ, M10/M12 | Nộp ảnh A vào E bằng UI hoặc multipart `files` tới `POST /api/exams/E/submissions` | HTTP 200, phản hồi là mảng 1 bài; đúng SBD/code/điểm; lưu ảnh gốc, ảnh nắn và ảnh chú thích |
| UP-02 / P0 | Nhiều ảnh, M10 | Chọn bốn ảnh A–D; theo dõi Network và hàng đợi, chờ hoàn tất | Đủ 4 bài, không thiếu/trùng do hàng đợi; UI chạy tối đa 3 request upload đồng thời; mỗi ảnh có kết quả riêng |
| UP-03 / P0 | PDF nhiều trang, M10 | Trên bộ thử sạch, nộp PDF 4 trang chứa A–D của đúng kỳ thi | HTTP 200, 4 bài; tên nguồn có `#trang1`…`#trang4`; điểm và SBD tương ứng; không chỉ chấm trang đầu |
| UP-04 / P1 | File không hợp lệ, M10 | Dùng API gửi TXT đổi đuôi JPG, ảnh 0 byte; thử ảnh hợp lệ nhưng là đồ vật | TXT/ảnh rỗng: 400; ảnh giải mã được nhưng không nhận ra phiếu thường tạo bài `error` trong phản hồi 200. Phân biệt lỗi upload với lỗi xử lý phiếu |
| UP-05 / P1 | Giới hạn file, M10 | Gửi file lớn hơn `40 * 1024 * 1024` byte; kiểm tra thêm file đúng giới hạn nếu có fixture phù hợp | Trên giới hạn trả 413 trước giải mã; đúng giới hạn đi tiếp bước giải mã, không có nghĩa chắc chắn chấm được. Giới hạn tính cho từng file |
| UP-06 / P1 | Hàng đợi có file lỗi, M10 | UI chọn 1 file sai định dạng và 2 ảnh tốt; chờ xong rồi bấm Xóa danh sách | File tốt vẫn được chấm; file lỗi có thông báo; Xóa danh sách chỉ dọn hàng đợi đã hoàn tất, không xóa bài trong DB |
| UP-07 / P1 | Một request gồm nhiều file, M10 | Qua API gửi ảnh hợp lệ trước rồi TXT không hợp lệ trong cùng request | Hành vi hiện tại: request kết thúc bằng 400 nhưng bài của file đầu có thể đã commit. GET danh sách để xác định số bài trước khi gửi lại; không kỳ vọng rollback cả lô |
| UP-08 / P1 | Nhập trùng, M10/M12 | Tải cùng ảnh A hai lần vào cùng kỳ thi | Tạo hai bài riêng, cả hai bị cờ `duplicate`; không tự ghi đè hay tự bỏ file trùng |
| UP-09 / P2 | Mất mạng và báo tiến độ, M10/M20 | Đang tải thì chặn mạng bằng DevTools; bật lại và nộp một ảnh khác | UI hiển thị lỗi, hàng đợi không kẹt vô hạn; ảnh mới vẫn gửi được. Kiểm tra DB trước khi gửi lại vì mất phản hồi không chứng minh server chưa lưu |

### 11.2. Webcam

| ID / mức | Chức năng, code | Bước thực hiện và dữ liệu | Kết quả mong đợi |
|---|---|---|---|
| CAM-01 / P1 | Quyền và vòng đời camera, M11 | Mở trên localhost, cho phép camera; đổi camera nếu có; chuyển khỏi tab Webcam | Có video; đổi đúng thiết bị; rời chế độ webcam thì dừng track, đèn camera tắt |
| CAM-02 / P1 | Từ chối camera, M11 | Chặn quyền rồi bấm Bật camera; thử truy cập HTTP bằng IP LAN trên điện thoại | Có thông báo không mở được camera hoặc yêu cầu localhost/HTTPS; người dùng vẫn có thể dùng tab tải ảnh |
| CAM-03 / P0 | Chụp tay, M11/M12 | Tắt tự động; đặt phiếu rõ; bấm Chụp & chấm; bấm liên tiếp khi đang xử lý | Đọc/điểm đúng như upload; có danh sách Vừa chấm; không chạy chồng hai lần capture khi đang bận |
| CAM-04 / P1 | Tự chụp, M11 | Bật tự động; đặt phiếu đủ góc; theo dõi request detect và lần nộp bài | Detect báo đủ 4 marker, điểm kiểm chứng ≥0,35; sau ít nhất 3 lần phát hiện liên tiếp và hết cooldown thì chụp; không chụp dồn khi đang xử lý |
| CAM-05 / P1 | Để nguyên phiếu, M11/M12 | Giữ nguyên phiếu trong khung hơn 8 giây sau lần chụp đầu | Hành vi hiện tại có thể chụp lại sau cooldown khoảng 3,5 giây; nếu tạo bài mới phải gắn cờ trùng SBD. Không có cơ chế bắt buộc rút phiếu ra rồi mới chụp tiếp |
| CAM-06 / P2 | Khung định vị, M11 | Đổi kích thước cửa sổ và tỷ lệ video, dịch phiếu trong khung | Lớp phủ bám đúng 4 góc; không lệch do khoảng trống `object-contain`; không nhận nhầm vật bất kỳ thành phiếu |

## 12. Quy tắc chấm điểm, cờ và trạng thái bài làm

Phân biệt ba trạng thái:

| Trạng thái | Khi nào xuất hiện trong code | Cách xác minh |
|---|---|---|
| `error` | Pipeline không đọc được phiếu | Có `error`, ảnh gốc; thường không có ảnh nắn/chú thích và không có điểm |
| `review` | Đọc được nhưng còn ít nhất một cờ khác `warning` | Có thể vẫn có điểm nếu tra được khóa; xem `flags` và ảnh để xử lý |
| `graded` | Không còn cờ chặn sau `evaluate` | Có thể còn cờ loại `warning`; không đồng nghĩa tất cả câu đều được tô |

| ID / mức | Quy tắc, code | Cách test | Kết quả mong đợi |
|---|---|---|---|
| GRADE-01 / P0 | Điểm chuẩn, M12 | Nộp A–D; so sánh từng câu và tổng với mục 3 | Đúng 10,8,5,0; điểm 10,8,5,0. Đối chiếu cả `answers`, không chỉ tổng điểm |
| GRADE-02 / P0 | Làm tròn, M12 | Kỳ thi 3 câu, thang 10, chỉ đúng 1 câu | Điểm API 3,33; câu đúng/3 được giữ đúng; không cộng dồn điểm đã làm tròn từng câu |
| GRADE-03 / P0 | Bỏ trống câu, M12 | Phiếu có SBD/code hợp lệ, chỉ bỏ trắng câu 1, chín câu còn lại đúng | Câu 1 là `""`, tính sai, điểm 9. **Không tự có cờ `blank` cho câu trả lời**; nếu không mờ và không có cờ khác thì vẫn `graded` |
| GRADE-04 / P0 | Tô hai phương án, M12 | Phiếu tô A và C cùng câu 1; chín câu khác đúng | `answers[0]` gồm hai chữ; cờ `multiple` ở `q1`; điểm 9, trạng thái `review` trước khi duyệt |
| GRADE-05 / P1 | Tô mờ/vết tẩy, M12/M19 | Chụp các mức tô rõ, mờ, tẩy còn đậm; giữ nhãn thật cho từng ảnh | Khi nhận không chắc, có `uncertain` đúng trường. Vết rất nhạt có thể không bị cờ; đo tỷ lệ phát hiện trên tập ảnh, không khẳng định mọi vết tẩy phải bị cờ |
| GRADE-06 / P0 | SBD/code thiếu hoặc nhiều ô, M12 | Bỏ trống một cột số; tô hai số ngang độ đậm; tô hai số có một ô đậm vượt trội | Thiếu trả `?`; nhiều ô không phân biệt được trả `*`; có thể chọn ô đậm nhất nếu chênh >40 mức xám nhưng vẫn có `uncertain`; đưa duyệt khi còn cờ |
| GRADE-07 / P0 | Không có khóa, M12 | Kỳ thi thử chưa có đáp án: nộp phiếu hợp lệ; sau đó thêm khóa đúng mã | Ban đầu `no_key`, score/num_correct null và `review`; thêm khóa sẽ tính lại bài mà không cần tải lại ảnh |
| GRADE-08 / P0 | Mã đề lạ, M12 | Đã có khóa 101 nhưng bài tô 999; sau đó đổi mã đề về 101 hoặc thêm khóa 999 | Ban đầu `unknown_code`, điểm null; sau sửa/thêm khóa tra được thì có điểm, cờ nghiệp vụ tương ứng hết |
| GRADE-09 / P1 | Ghép roster, M09/M12 | Có roster 5 người: nộp SBD 999999; thêm người này rồi kiểm tra lại; lặp trên kỳ thi hoàn toàn không roster | Có roster: ban đầu `unknown_student`, sau thêm được ghép và cờ biến mất; không roster thì không tự có `unknown_student` chỉ vì không tìm thấy tên |
| GRADE-10 / P0 | Trùng SBD, M12/M14 | Nộp hai ảnh cùng SBD; xóa một bài; đọc lại bài còn lại | Cả hai có `duplicate` khi cùng tồn tại; xóa một bài tính lại cờ cho bài còn lại. Không tự chọn “bài chính thức” |
| GRADE-11 / P0 | Phiếu sai kỳ thi, M12 | Nộp phiếu `TEST_OMR_OTHER` vào E, dùng cùng số câu/phương án để chỉ kiểm tra ID | Có `mismatch` ở `sheet`, không chuyển bài sang kỳ thi khác, đưa `review`; không kỳ vọng luôn trả HTTP 400 |
| GRADE-12 / P1 | Phiếu cũ khác số câu, M12 | In phiếu 10 câu; trước khi có bài đổi kỳ thi thành 20 câu; nộp phiếu cũ còn QR đọc được | Lõi đọc theo cấu hình QR của phiếu cùng E; service thêm `mismatch` số câu, đệm kết quả đến số câu kỳ thi; phải duyệt, không coi là chấm hợp lệ ngay |
| GRADE-13 / P0 | Duyệt vẫn còn lỗi nghiệp vụ, M12/M14 | Với bài có `unknown_student`, `duplicate` hoặc `unknown_code`, gửi `reviewed=true` mà chưa sửa nguyên nhân | `reviewed=true` chỉ bỏ cờ OMR; cờ nghiệp vụ được tính lại, bài có thể vẫn `review`. Không ép `graded` bằng nút duyệt |

## 13. Xem kết quả, sửa bài và lịch sử phúc tra

| ID / mức | Chức năng, code | Bước thực hiện và dữ liệu | Kết quả mong đợi |
|---|---|---|---|
| RESULT-01 / P1 | Danh sách/lọc/tìm/sắp xếp, M13 | Có đủ graded/review/error; chọn từng bộ lọc; tìm SBD/tên/tên file; bấm sắp theo ID/SBD/điểm/tin cậy hai lần | Đúng tập kết quả và chiều sắp xếp; điểm null không hiển thị thành 0. API `status=invalid` trả 422 |
| RESULT-02 / P0 | Chi tiết và 3 ảnh, M13 | Mở bài hợp lệ, so ảnh gốc/nắn/chú thích; thử `/image/other`; thử ảnh nắn của bài error | Bài hợp lệ có các ảnh tương ứng, đúng SBD; kind không hỗ trợ hoặc ảnh không có trả 404; UI bài lỗi vẫn xem được ảnh gốc |
| REVIEW-01 / P0 | Sửa câu và lưu, M14/M12 | Bài A trong kỳ thi thử: đổi câu 1 A→B trên lớp phủ; Lưu; tải lại | `num_correct` 10→9, score 10→9; answers đổi, `omr_answers` vẫn giữ A; lịch sử `edit` ghi câu 1 A→B |
| REVIEW-02 / P1 | Bấm chọn/xóa/tô nhiều, M14 | Bấm ô đã chọn; Shift/Ctrl+bấm ô khác; thử lưới bên cạnh và phóng to ảnh | Bấm lại bỏ chọn; Shift/Ctrl cho nhiều lựa chọn; lưới và lớp phủ cùng phản ánh dữ liệu; vị trí ô bám ảnh khi zoom |
| REVIEW-03 / P0 | Sửa SBD và mã đề, M14/M12 | Đổi bài có SBD lạ về người có roster, đổi code lạ về 101; lưu rồi tải lại | Ghép thí sinh đúng, tra khóa đúng, tính điểm lại; `omr_sbd`/`omr_exam_code` không đổi; lịch sử có giá trị cũ/mới |
| REVIEW-04 / P0 | Duyệt và phím tắt, M14 | Bài chỉ còn cờ OMR: sửa đúng, dùng Ctrl+S rồi Ctrl+Enter; thử Alt+←/→ | Ctrl+S lưu; Ctrl+Enter lưu và đánh dấu đã duyệt; hết cờ chặn thì `graded`; chuyển đúng bài còn trong hàng đợi; Alt di chuyển trước/sau |
| REVIEW-05 / P1 | Hàng đợi duyệt, M13/M14 | Có 3 bài review; mở Duyệt nhanh; duyệt lần lượt tới cuối | Không nhảy sang kỳ thi khác; `review_remaining` đúng; duyệt xong có thông báo; nút trước/sau xử lý biên không còn bài |
| REVIEW-06 / P0 | Khôi phục, M14 | Sửa câu/SBD/code, đánh dấu duyệt; Hủy reset rồi xác nhận reset | Hủy giữ nguyên; xác nhận lấy lại `omr_*`, `reviewed=false`, `resolved=[]`; điểm/cờ tính lại; thêm lịch sử `reset` |
| REVIEW-07 / P1 | Reset với khóa mới, M14/M12 | Sửa tay bài, thay đáp án chuẩn rồi reset bài | Bài về kết quả **máy đọc ban đầu**, nhưng được chấm theo **khóa hiện tại**; không kỳ vọng điểm lịch sử trước khi đổi khóa |
| REVIEW-08 / P1 | Validation sửa bài, M14 | PATCH đáp án ngoài A–D; SBD chữ; code dài 4; mảng đáp án ngắn/thừa | Phương án sai: 400; SBD/code sai pattern: 422; mảng thiếu/thừa được đệm/cắt như code. SBD/code khi PATCH không tự zfill như lúc tạo thí sinh/khóa |
| REVIEW-09 / P1 | Lịch sử và nhật ký, M14/M15 | Tải bài → sửa → duyệt → reset; xem `/history` và `/activity` | Có upload/edit/reset tương ứng, người thực hiện, thời gian, nội dung; mới nhất trước. Không mặc định mọi thao tác hệ thống đều có audit |
| REVIEW-10 / P0 | Xóa bài và dữ liệu liên quan, M14/M15 | Hủy rồi xác nhận xóa bài thử; gọi lại API chi tiết/ảnh; xem danh sách, stats và Excel | Sau xóa bài/ảnh trả 404; tổng bài giảm; cờ trùng được tính lại nếu có; activity kỳ thi có `delete_submission` |
| REVIEW-11 / P1 | Cập nhật các màn hình, M13/M14/M15/M16 | Mở stats/dashboard trước; quay sang sửa bài/khóa/roster rồi quay lại các trang, xuất Excel | Kết quả trên UI phải đồng nhất API và Excel; thử cả chuyển tab lẫn F5 để phân biệt cache UI với dữ liệu server. Nếu chỉ F5 mới đúng, ghi lỗi làm mới cache |

## 14. Thống kê, tổng quan và xuất Excel

### 14.1. Thống kê và phân tích câu hỏi

| ID / mức | Chức năng, code | Cách test | Kết quả mong đợi |
|---|---|---|---|
| STAT-01 / P0 | Các chỉ số tổng, M15 | Dùng E chỉ có bốn bài A–D, GET `/api/exams/E/stats` và mở UI | Đúng mọi giá trị mục 3.3: mean 5,75; median 6,50; stdev 3,77; pass_rate 0,75; absent 1 |
| STAT-02 / P1 | Phổ điểm, M15 | Xem histogram của E; kiểm tra bài 0, 5, 8 và 10 | 10 khoảng đều, tổng count=4; 10 điểm nằm ô cuối, không sinh ô thứ 11; giá trị đúng ranh giới vào khoảng bắt đầu tại ranh giới đó |
| STAT-03 / P1 | Theo lớp/mã đề/top, M15 | Xem lớp và top của E; thêm 102 trên kỳ thi thử riêng; thử hai bài đồng điểm | Lớp đúng mục 3; mã đề được tách nhóm; top giảm dần điểm, bằng điểm tăng dần SBD; tối đa 10 bài |
| STAT-04 / P0 | Độ khó và phân biệt, M15 | Kiểm tra câu 1 E; tập khác có dưới 4 bài; các ca p tại 0,3 và 0,7 | E: p=0,75 và D=1; dưới 4 bài: D null; p≥0,7 Dễ, 0,3≤p<0,7 Trung bình, còn lại Khó |
| STAT-05 / P1 | Phân bố phương án, M15 | Nhóm một mã đề có câu chọn A/B/C/D, bỏ trống và tô nhiều; đếm tay | Tổng count phương án + blank + multi = số bài có điểm của mã đề; tô nhiều đếm riêng, không cộng một bài vào cả A và C |
| STAT-06 / P1 | Bộ lọc mã đề, M15 | Hai mã đề có thứ tự đáp án khác; gọi `stats?code=101`, `?code=102` | `items`/`item_code` đổi theo code. **Overview, histogram, by_class, by_code, top vẫn của toàn kỳ thi** theo code hiện tại; không coi đây là bộ lọc toàn bộ báo cáo |
| STAT-07 / P1 | Không có bài/không có điểm, M15 | Kỳ thi trống; kỳ thi chỉ có bài error hoặc thiếu khóa; mở thống kê và xuất Excel | Không chia 0; mean/min/max/pass_rate null khi không có điểm; số trạng thái đúng; histogram toàn 0; không vẽ giá trị null thành điểm 0 |
| STAT-08 / P0 | Bài cần duyệt có điểm, M12/M15 | Thêm bài review nhưng có khóa; so thống kê trước/sau | Bài có score vẫn vào mean/histogram/item analysis dù chưa duyệt; không mặc định báo cáo chỉ gồm `graded`. Xem thêm rủi ro thống kê mục 18 |
| DASH-01 / P1 | Dashboard và quyền, M05/M15 | A/B có kỳ thi riêng; xem tổng bài, review, error, điểm trung bình, gần đây và hoạt động; so API | Mỗi giáo viên chỉ thấy phạm vi của mình; admin thấy toàn bộ; số liệu khớp dữ liệu có quyền truy cập |
| DASH-02 / P2 | Tổng quan kỳ thi/demo/activity, M15/M18 | Tạo kỳ thi trống, sinh demo n=4 rồi gọi lại; kiểm tra tổng quan, activity | Có roster/khóa nếu ban đầu chưa có; bài được chấm; lần tiếp theo không tạo lại bài cho thí sinh đã nhận diện có bài. Đọc `created` thực tế, không áp đặt đủ n |

Khi kiểm tra phân tích câu hỏi, dùng bộ khóa **đủ đáp án**. Với khóa thiếu câu, code thống kê hiện so trực tiếp `a == k`, còn hàm chấm điểm yêu cầu `bool(k)`; trường hợp cả hai rỗng có thể tạo mâu thuẫn. Đây là ca cần phát hiện lỗi, xem GAP-03.

### 14.2. File Excel

| ID / mức | Chức năng, code | Cách test | Kết quả mong đợi |
|---|---|---|---|
| XLSX-01 / P0 | Tải và mở file, M16 | Bấm Xuất Excel hoặc GET `/api/exams/E/export.xlsx`; mở bằng Excel/LibreOffice | HTTP 200, đúng MIME XLSX, tên file tải hợp lệ, mở không báo sửa file; chữ tiếng Việt hiển thị đúng |
| XLSX-02 / P0 | Bảng điểm chuẩn, M16 | Đối chiếu 5 người, 4 điểm và ngưỡng đạt ở E | Sheet Bảng điểm có 5 người; điểm 10,8,5,0 và 1 vắng; 5 điểm vẫn Đạt; số 0 phải hiển thị 0, không thành ô trống |
| XLSX-03 / P1 | Chi tiết và phân tích, M16/M15 | Đối chiếu từng câu A–D với API, sheet Phân tích câu hỏi với stats | Chi tiết đủ 10 cột câu; khớp dữ liệu sau sửa tay; p/D và đếm phương án khớp API; sheet phân tích chỉ được tạo khi `items` không rỗng |
| XLSX-04 / P1 | Bất thường và vắng, M16 | Kỳ thi thử có bài chưa ghép roster, review, error, thí sinh vắng và SBD trùng | Ghi chú/trạng thái phù hợp; người chưa có bài là Vắng; Chi tiết bài làm chứa mọi bài. Bảng điểm chỉ chọn một bài mỗi thí sinh đã ghép theo hành vi hiện tại, không phải danh sách đầy đủ mọi lần nộp |

## 15. Phòng thí nghiệm xử lý ảnh

API chính: `POST /api/lab/analyze`, multipart `file`, tùy chọn `num_questions`, `num_options`. Trên UI hiện chỉ có ô nhập số câu dự phòng; số phương án mặc định 4 nếu không đọc QR.

| ID / mức | Chức năng, code | Cách test | Kết quả mong đợi |
|---|---|---|---|
| LAB-01 / P1 | Phân tích ảnh hợp lệ, M17/M19 | Tải ảnh A; duyệt các bước; mở ảnh phóng lớn | `ok=true`; các bước theo thứ tự: `input`, `gray`, `background`, `normalized`, `binary`, `markers`, `warped`, `qr`, `align_blocks`, `values`, `threshold`, `result` |
| LAB-02 / P1 | Nội dung bước, M17/M19 | Xem ảnh xám/nền/nhị phân, ma trận H, khung khối, heatmap và biểu đồ ngưỡng | Ảnh đúng ý nghĩa từng bước; H 3×3; giá trị ô 0–255; biểu đồ tăng theo thứ tự sắp xếp; ngưỡng khớp dữ liệu trả về; SBD/code/answers đúng |
| LAB-03 / P1 | Ảnh lỗi và thiếu QR, M17 | Ảnh không phải phiếu; phiếu che QR với/không có số câu; API thử 6 phương án khi QR che | Ảnh giải mã được nhưng không căn chỉnh: HTTP 200, `ok=false`, còn bước đã chạy và lỗi; thiếu QR/cấu hình có lỗi giải thích; cấu hình đúng qua API cho phép tiếp tục |
| LAB-04 / P2 | Ảnh mẫu, M17/M18 | Sinh mẫu nhiều mức độ khó; cùng seed/strength gọi API hai lần | Trả JPEG; cùng tham số có thể tái lập bộ mẫu để so sánh; summary/flags đúng ảnh thực tế. Mẫu mặc định thuộc exam_id 0, không dùng trực tiếp làm bài hợp lệ cho E |
| LAB-05 / P1 | Không lưu bài, M17 | Ghi số bài và danh sách uploads trước/sau Analyze/Sample/Detect | Không tạo Submission hoặc ảnh bài làm trong uploads; chỉ trả kết quả phân tích |
| LAB-06 / P1 | PDF trong Lab, M17 | Nộp PDF có 4 trang, trang 1 là A, trang 2–4 khác A | Lab chỉ lấy trang đầu theo `load_image_bytes(...)[0]`; kết quả là A. Chấm đủ các trang phải dùng API nộp bài ở M10 |

## 16. Kiểm thử lõi xử lý ảnh cho hợp lý

### 16.1. Kiểm tra từng giai đoạn

Dùng Lab để quan sát và `process_image(..., debug=True)` khi kiểm tra ở mức Python. Dùng cùng một ảnh gốc đã biết nhãn, chỉ thay **một yếu tố mỗi lần** để biết lỗi bắt đầu ở bước nào.

| ID / mức | Giai đoạn, code M19 | Dữ liệu/cách test | Điều cần đối chiếu |
|---|---|---|---|
| OMR-01 / P1 | Ảnh xám/chuẩn hóa nền: `to_gray`, `estimate_background`, `normalize_illumination` | Cùng phiếu sạch và phiếu có bóng đổ/gradient sáng | Nền sau chuẩn hóa đồng đều hơn, nét tô vẫn phân biệt; SBD/đáp án không đổi trong điều kiện được chấp nhận |
| OMR-02 / P1 | Nhị phân: `binarize_dark` | Ảnh sáng/tối, nhiễu hạt; xem bước binary | Ngưỡng Otsu bị kẹp 60–150; marker không bị mất do nhiễu hoặc dính nền; không kết luận đạt chỉ vì ảnh nhị phân trông rõ |
| OMR-03 / P0 | Marker: `find_marker_candidates`, `marker_quads`, `select_markers` | Phiếu tô đậm nhiều ô, có vật vuông cạnh phiếu | Chọn đúng 4 góc phiếu; không nhầm vòng tròn tô đen thành marker; kiểm chứng hình mẫu đúng |
| OMR-04 / P0 | Xoay/nắn: `align`, `warp` | Cùng phiếu ở 0°,90°,180°,270°, nghiêng phối cảnh vừa phải | Nội dung đọc giống nhãn ở mọi chiều; ảnh chuẩn 1260×1782 tại 6 px/mm; không dùng số `rotation` riêng lẻ làm bằng chứng đọc đúng |
| OMR-05 / P1 | Dự phòng mép giấy: `find_page_quad`, `align` | Che một marker nhưng giữ mép giấy và bố cục; thêm ảnh che nặng | Có thể dùng `page+markers`/`page`; `page` có warning và confidence giảm. Nếu không đủ điều kiện thì báo lỗi, không bắt buộc ảnh che marker nào cũng đọc được |
| OMR-06 / P0 | QR: `decode_qr_from`, `layout.decode_qr` | QR rõ, QR che, phiếu sai ID và khác cấu hình | QR rõ đúng exam_id/số câu/phương án; khi không có QR phải dùng cấu hình cung cấp; sai ID có mismatch. Phiếu không phải mẫu hệ thống không được coi là đầu vào chuẩn |
| OMR-07 / P1 | Căn chỉnh khối: `align_block` | Giấy hơi cong/nhăn, vùng SBD và cột câu hơi lệch | `shifts` có dx/dy/điểm khớp; vùng tìm ±2,5 mm; tâm đo theo ô thực tế. Sai lệch quá lớn có thể cần chụp lại |
| OMR-08 / P0 | Đo/ngưỡng: `read_bubbles`, `find_jump_threshold` | Một câu một ô, nhiều ô, bỏ trắng; nhiều độ đậm bút | Đo phần lõi bán kính 62%; marked khi giá trị < ngưỡng; cờ mờ/multiple hợp lý; so từng đáp án với nhãn và lưu sai khác |
| OMR-09 / P1 | Cờ/độ tin cậy: `process_image`, `OMRResult.needs_review` | Phiếu sạch so với phiếu mờ/tẩy; phiếu trắng | Confidence trong [0,1]; phân biệt warning với cờ chặn. Không dùng confidence cao để bỏ qua sai nhãn hoặc cờ nghiệp vụ |

### 16.2. Tập ảnh nên có

| Nhóm | Mức đề xuất | Cách đánh giá |
|---|---|---|
| Chuẩn | In/scan rõ, tô đúng; các bố cục 1,10,40,120 câu và 2,4,6 phương án | Đòi hỏi đúng nhãn toàn bộ trong bộ chuẩn đã thống nhất |
| Xoay/phối cảnh | 4 chiều; ba mức nghiêng nhẹ/vừa/nặng | Ghi tỷ lệ căn chỉnh, đọc SBD/code và từng câu theo mức |
| Ánh sáng | Đều, bóng nhẹ, bóng đậm, phản quang | So với cùng phiếu không bóng để xác định giới hạn |
| Nét tô | Đậm, nhạt, tô lệch, bỏ trắng, tô hai, tẩy | Ghi cả đọc đúng và gắn cờ; không trộn tô hai với lỗi giải mã |
| Chất lượng | Mờ rung, giảm độ phân giải, JPEG nén, giấy cong | Với ảnh không dùng được, báo lỗi/chụp lại rõ ràng; kiểm tra tránh chấm sai âm thầm |
| Ảnh thật | Đề xuất ít nhất 30 phiếu, nhiều người tô và vài thiết bị | Hai người đối chiếu nhãn; giữ ảnh gốc và tách kết quả khỏi ảnh tổng hợp |

Đây là quy mô gợi ý để bắt đầu, không phải bằng chứng độ chính xác thống kê cho mọi điều kiện. Chốt trước tập ảnh nào phải đọc chính xác và tập ảnh nào dùng thăm dò giới hạn; không thay tiêu chí sau khi thấy kết quả.

### 16.3. Chạy đánh giá tái lập

```powershell
# Smoke nhỏ trước khi sinh tập lớn; không dùng lại thư mục chứa dữ liệu muốn giữ.
.\.venv\Scripts\python.exe -m tools.evaluate --n 10 --questions 10 --options 4 --out dataset/synthetic/smoke

# Các đợt đánh giá riêng theo bố cục.
.\.venv\Scripts\python.exe -m tools.evaluate --n 50 --questions 40 --options 4 --out dataset/synthetic/q40_o4
.\.venv\Scripts\python.exe -m tools.evaluate --n 50 --questions 120 --options 6 --out dataset/synthetic/q120_o6

# Đọc lại tập đã có truth.json, không sinh ảnh ghi đè.
.\.venv\Scripts\python.exe -m tools.evaluate --eval-only --out dataset/real
```

`dataset/real/truth.json` có dạng sau; số phần tử `answers` phải đúng với phiếu thật. `erased` dùng số câu bắt đầu từ 1. Nếu QR bị che, script hiện truyền số câu từ nhãn và mặc định 4 phương án; muốn đánh giá ảnh thật 2/6 phương án không QR phải bổ sung cách truyền `num_options` vào `tools/evaluate.py`, không dùng kết quả mặc định 4 để kết luận.

```json
{
  "real_001.jpg": {
    "sbd": "000001",
    "exam_code": "101",
    "answers": ["A", "B", "C", "D", "A", "B", "C", "D", "A", "B"],
    "erased": [],
    "rotation": 0
  }
}
```

Lưu `truth.json`, `report.json`, tham số lệnh, phiên bản code, cấu hình máy và danh sách ảnh lỗi. Báo cáo ít nhất: căn chỉnh thành công, SBD đúng, code đúng, từng câu đúng, phiếu đúng hoàn toàn, câu sai không cờ, cờ báo nhầm, vết tẩy được cờ và thời gian.

**Giới hạn của script cần nhớ:** “Đọc được mã QR” hiện đếm QR khác null, chưa so đủ nội dung QR với nhãn; độ đúng từng câu được tính trên phiếu đã căn chỉnh; thời gian trung bình gồm các lần xử lý, kể cả thất bại. Các số này không tự bao gồm HTTP, DB, ghi ảnh hoặc độ trễ webcam.

## 17. Kiểm thử API bằng lệnh và bộ test hiện có

### 17.1. Ví dụ PowerShell dùng cookie phiên

Server phải đang chạy. Ví dụ tạo **kỳ thi riêng** để không thay đổi E chuẩn:

```powershell
$baseUrl = "http://127.0.0.1:8000"
$loginBody = @{ username = "admin"; password = "admin123" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/login" `
  -ContentType "application/json" -Body $loginBody -SessionVariable omrSession

$examBody = @{
  name = "TEST_API_10"; num_questions = 10; num_options = 4
  max_score = 10; pass_score = 5
} | ConvertTo-Json
$examResult = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/exams" `
  -ContentType "application/json" -Body $examBody -WebSession $omrSession
$examId = $examResult.id

$keyBody = @{ code = "101"; answers = "ABCDABCDAB" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$baseUrl/api/exams/$examId/keys" `
  -ContentType "application/json" -Body $keyBody -WebSession $omrSession

Invoke-RestMethod -Uri "$baseUrl/api/exams/$examId/stats" -WebSession $omrSession
Invoke-WebRequest -Uri "$baseUrl/api/exams/$examId/sheet.pdf" `
  -WebSession $omrSession -OutFile "test_sheet.pdf"
```

Với upload qua Postman/Swagger: chọn body **form-data**, tên trường `files` cho chấm bài, `file` cho nhập thí sinh/đáp án/Lab. Không gửi đường dẫn file dưới dạng JSON. Khi thử nhiều file trong một request, tạo nhiều dòng cùng tên `files`.

Ví dụ PATCH kiểm tra phúc tra, thay S bằng ID bài test:

```json
{
  "sbd": "000001",
  "exam_code": "101",
  "answers": ["B", "B", "C", "D", "A", "B", "C", "D", "A", "B"],
  "reviewed": true
}
```

| HTTP | Cách diễn giải trong dự án |
|---:|---|
| 200 | Request được xử lý; vẫn phải kiểm tra `status`, `flags`, `errors` hoặc `ok` trong body |
| 400 | Lỗi nghiệp vụ hoặc nội dung đầu vào bị từ chối |
| 401 | Chưa có phiên hợp lệ |
| 403 | Đã xác thực nhưng không đủ quyền |
| 404 | Tài nguyên/ảnh không tồn tại |
| 413 | File chấm bài vượt giới hạn |
| 422 | Vi phạm schema/kiểu dữ liệu/tham số đã khai báo |
| 500 | Lỗi server cần ghi nhận; không xem là thông báo đầu vào hợp lệ |

### 17.2. Test tự động đang có và phần chưa bao phủ

```powershell
.\.venv\Scripts\python.exe -m pytest tests -q
.\.venv\Scripts\python.exe -m pytest tests/test_api.py::test_full_flow -q
```

[tests/test_api.py](../tests/test_api.py) đặt `OMR_DATA_DIR` vào thư mục tạm trước khi import app, tạo ảnh bằng `synth` và gọi API qua `TestClient`; không cần chạy server ngoài. Bộ test hiện có **3 test function**, không có nghĩa đã kiểm thử mọi ca trong tài liệu.

| Test có sẵn | Đã kiểm tra bằng assertion | Phần không được suy ra từ test đó |
|---|---|---|
| `test_full_flow` (dòng 31) | Login/me; tạo kỳ thi; MIME PDF; lưu chuỗi đáp án; import 2 thí sinh CSV; chấm ảnh và số câu đúng; số item OMR; ảnh chú thích; sửa một câu đổi số đúng; audit edit; stats có 1 bài và đủ item; tải XLSX có dữ liệu | Chưa xác minh toàn bộ nội dung PDF/XLSX, mọi công thức stats, boundary, phân quyền hai giáo viên hoặc UI |
| `test_demo_and_lab` (dòng 77) | Demo 4 bài có điểm; Lab xử lý được ảnh và bước cuối `result` | Chưa kiểm tra mọi bước ảnh trung gian, webcam, nhiều trang PDF hoặc mọi loại cờ |
| `test_auth_required` (dòng 92) | GET danh sách kỳ thi không cookie trả 401 | Chưa bao phủ các endpoint khác, token hết hạn hoặc quyền admin/owner |

Nếu bổ sung tự động hóa, ưu tiên các assertion độc lập có giá trị: phân quyền trực tiếp, công thức điểm với dữ liệu biết trước, tính lại sau sửa khóa/roster, trạng thái cờ, reset giữ OMR gốc, PDF nhiều trang và thống kê chuẩn mục 3. Với UI, bộ test hiện tại chưa có Playwright/Cypress; thao tác camera và chất lượng bản in cần kiểm tra thủ công.

### 17.3. Kiểm tra giao diện, lưu trữ và hiệu năng

| ID / mức | Code | Cách test | Tiêu chí |
|---|---|---|---|
| SYS-01 / P1 | M20 | GET `/api/health`; mở thẳng `/exams/E/results` rồi F5 sau build | Health `{"ok":true}`; SPA tải được đường dẫn sâu; route API không tồn tại trả 404 |
| SYS-02 / P1 | M20 | Tạo bài/khóa/roster, dừng và chạy lại server với cùng OMR_DATA_DIR | Dữ liệu và ảnh còn; không tạo lại admin hoặc reset điểm; phiên hợp lệ còn dùng được nếu khóa ký và thời hạn không đổi |
| SYS-03 / P2 | M20 và UI | Cửa sổ desktop/điện thoại; mở modal, Esc, menu, các bảng dài và 120 câu | Không che nút chính; bảng cuộn được; thao tác bàn phím có thể dùng; không có lỗi Console làm hỏng luồng |
| SYS-04 / P1 | M01/M10/M20 | Xóa cookie khi đang ở app; gọi API thường và upload riêng | API trả 401; UI nên về đăng nhập/thông báo phiên hết hạn; upload XHR cần kiểm tra riêng vì khác đường xử lý fetch |
| PERF-01 / P2 | M10/M12/M18 | Đo 10 rồi 50 ảnh, lặp 3 lần cùng tập; ghi CPU/RAM, thời gian tổng, thời gian pipeline và HTTP | Đủ bài, không lỗi DB khóa/mất ảnh; ghi trung vị và p95, tách tải file với xử lý. Ngưỡng thời gian cần thống nhất theo máy, không dùng con số README làm SLA mặc định |

## 18. Các điểm cần kiểm tra kỹ và khoảng trống từ mã nguồn

Các mục này là **rủi ro/hành vi suy ra từ đọc code, chưa phải lỗi đã tái hiện trong phiên này**. Kết quả thực nghiệm quyết định Pass/Fail. Với hành vi cần thay đổi nghiệp vụ, ghi Needs decision nếu chưa có yêu cầu được thống nhất.

| ID | Code liên quan | Ca kiểm tra và tiêu chí đề xuất |
|---|---|---|
| GAP-01 | `schemas.ExamUpdate`, `exams.update_exam` | PUT `name=""` hoặc `name=null`: schema cập nhật không có cùng ràng buộc tên như khi tạo. Kỳ vọng nghiệp vụ là từ chối 4xx và không lưu hỏng dữ liệu; xác minh có xảy ra lỗi DB/response 500 hay không |
| GAP-02 | `ExamBase`, `ExamUpdate` | `pass_score > max_score` hiện chưa có ràng buộc chéo. Chạy qua API, ghi hệ thống chấp nhận hay từ chối; cần quyết định có cho phép cấu hình không ai đạt hay không |
| GAP-03 | `score_answers`, `stats.exam_stats` | Khóa câu 10 rỗng và bài câu 10 cũng rỗng: điểm không tính đúng nhưng `items` hiện so `a == k`, có thể ghi câu này đúng. Tiêu chí: điểm và thống kê phải thống nhất, hoặc thống kê đánh dấu câu không có khóa và loại khỏi phép tính theo quy tắc được chốt |
| GAP-04 | `grading.evaluate`, `stats.exam_stats`, `excel.export_results` | Bài trùng SBD vẫn có điểm; stats tính trên mọi bài có điểm, Bảng điểm chọn một bài mỗi student, Chi tiết giữ mọi bài. Đối chiếu khi có trùng trước khi dùng báo cáo chính thức; cần quy tắc chọn bài hợp lệ |
| GAP-05 | `patch_submission`, `grading.evaluate` | Sửa SBD của bài A thành SBD bài B đã có, sau đó sửa sang SBD khác: PATCH chỉ evaluate bài đang sửa, khác luồng upload/xóa vốn có tính lại bài cùng SBD. Kiểm tra cờ duplicate ở **cả bài cũ và bài mới** có được thêm/gỡ đồng bộ |
| GAP-06 | `excel.read_table`, `load_image_bytes`, router import/Lab | Nhập XLSX hỏng, CSV không xác định delimiter, PDF hỏng/mã hóa: không phải mọi exception thư viện đều được chuyển thành 400. Tiêu chí: báo lỗi rõ bằng 4xx, không 500, không lưu dữ liệu nửa chừng ngoài hành vi đã công bố |
| GAP-07 | `grading.answers_from_sheet`, `exams.key_from_sheet` | Phiếu đáp án thuộc kỳ thi khác: pipeline có thể trả cờ mismatch nhưng endpoint chỉ trả warnings cho trường bắt đầu `q`. Kiểm tra không lưu nhầm khóa từ phiếu khác mà người dùng không được thông báo |
| GAP-08 | `exams.import_keys`, `excel.parse_keys` | Import code dài hơn 3 số, ví dụ 1234: đường import không đi qua `KeyIn` như nhập tay. Kiểm tra tính nhất quán với khối mã đề vật lý chỉ có 3 cột |
| GAP-09 | `frontend/src/lib/api.ts::upload`, `auth.tsx` | API fetch phát sự kiện `omr:unauthorized` khi 401, đường upload XHR hiện không làm tương tự. Xóa phiên rồi upload để kiểm tra UI có xử lý hết phiên hợp lý |
| GAP-10 | `Review.tsx::invalidate`, `Keys.tsx`, `Students.tsx`, `Grade.tsx` | Các mutation không invalidate mọi query thống kê/dashboard/students. Mở trang liên quan trước rồi sửa dữ liệu, quay lại; nếu còn số cũ dù API đã đổi, ghi lỗi cache và đường thao tác cụ thể |
| GAP-11 | `security.read_token`, `auth.logout`, `auth.change_password` | Logout xóa cookie ở client; đổi mật khẩu không có cơ chế thu hồi tất cả token cũ trong code. Nếu yêu cầu phải đăng xuất mọi thiết bị, dùng hai phiên kiểm tra và ghi khoảng trống; không áp đặt token đã sao chép tự hết hiệu lực sau logout |
| GAP-12 | `pipeline.process_image`, `grading.grade_image` | Phiếu cùng ID nhưng QR có số phương án khác cấu hình kỳ thi: kiểm tra có cảnh báo phù hợp. Service hiện thêm mismatch riêng cho **số câu**, chưa có kiểm tra tương tự rõ ràng cho số phương án |
| GAP-13 | `Review.tsx::ReviewBody` | Sửa chưa lưu rồi Alt+←/→ hoặc chuyển trang: kiểm tra có mất thay đổi ngoài ý muốn; code hiện chưa có chặn điều hướng khi dirty. Chốt có cần cảnh báo trước khi rời trang |
| GAP-14 | `Grade.tsx::UploadMode` | Hàng đợi có cả lỗi request và kết quả bài: số “đã chấm” dùng `results.length - nReview - nErr` trong khi `nErr` gồm lỗi request không tạo bài. Kiểm tra bộ đếm không âm và khớp tổng thực tế |

## 19. Thứ tự chạy và tiêu chí hoàn thành

### 19.1. Thứ tự hợp lý

1. Kiểm tra khởi động/health và đăng nhập.
2. Tài khoản và phân quyền; dùng phiên admin và hai giáo viên riêng.
3. Tạo E, đáp án, roster, phiếu; xác nhận dữ liệu đầu vào đúng trước khi chấm.
4. Chấm A–D; kiểm tra từng câu, điểm, stats và Excel ngay khi bộ chuẩn còn sạch.
5. Dùng kỳ thi riêng cho lỗi đầu vào, trùng SBD, thiếu khóa, reset và xóa.
6. Chạy Lab và đánh giá OMR trên tập tổng hợp, sau đó trên ảnh thật có nhãn.
7. Test webcam, mất mạng, cache và hiệu năng khi các luồng cơ bản đã ổn.
8. Sau sửa lỗi, chạy lại ca lỗi và phần phụ thuộc theo bảng dưới.

| Phần thay đổi | Bộ hồi quy nên chạy |
|---|---|
| Xác thực/phân quyền | AUTH, USER, ACL, API ảnh/file xuất, SYS-04 |
| Layout/PDF/marker/reader | SHEET, OMR, GRADE, PDF nhiều trang, Lab, ảnh thật |
| Điểm/khóa/roster | KEY, STU, GRADE, REVIEW, STAT, XLSX |
| Duyệt/sửa/reset/xóa | REVIEW, duplicate, STAT, XLSX, kiểm tra cache liên quan |
| UI upload/camera/API client | UP, CAM, lỗi mạng, hết phiên, số lượng bài trong DB |

### 19.2. Điều kiện kết thúc đợt kiểm thử

- Tất cả ca P0 đã thực hiện và đạt; P0 lỗi hoặc thiếu môi trường phải ghi rõ, không gộp thành Pass.
- Bộ chuẩn đúng từng SBD, code, câu trả lời, điểm và công thức báo cáo.
- Không truy cập được kỳ thi/bài/ảnh/file xuất ngoài quyền giáo viên.
- Sửa tay không ghi đè kết quả OMR gốc; reset và lịch sử hoạt động đúng.
- Ảnh lỗi, bài cần duyệt và dữ liệu chưa đủ khóa được biểu diễn rõ; không lẫn với bài đã chấm hợp lệ.
- Kết quả ảnh thật được báo riêng với ảnh tổng hợp; các ca sai không có cờ được điều tra.
- File PDF/Excel được mở kiểm tra nội dung; UI được kiểm tra cùng phản hồi API.
- Mọi ca chưa chạy, Blocked hoặc Needs decision có lý do và người/việc cần xử lý tiếp.

## 20. Mẫu ghi nhận và tình trạng xác minh tài liệu

### 20.1. Phiếu chạy test

| Run ID | Ngày / người test | Phiên bản code | Môi trường / OMR_DATA_DIR |
|---|---|---|---|
| RUN-001 | … | Git commit hoặc bản mã … | Python …, OS …, trình duyệt …, thư mục … |

| Test ID | Dữ liệu / E / S | Kết quả thực tế | Trạng thái | Bằng chứng / lỗi |
|---|---|---|---|---|
| GRADE-01 | E=…, A–D | … | Not run | Ảnh + JSON + điểm đối chiếu … |
| ACL-02 | user B, S=… của A | … | Not run | Request/response … |
| STAT-01 | E=… chỉ có 4 bài chuẩn | … | Not run | stats JSON + ảnh màn hình … |

Trạng thái dùng: **Not run / Pass / Fail / Blocked / Needs decision**. Với ca nhiều biến thể, thêm hậu tố như `EXAM-02-q0`, `EXAM-02-q121` để không bỏ sót.

### 20.2. Mẫu báo lỗi

```text
Mã lỗi: BUG-...
Test liên quan: ...
Chức năng / mức ưu tiên: ...
Phiên bản và môi trường: ...
Tài khoản/vai trò, E, S: ...
Tiền điều kiện và fixture: ...
Bước tái hiện: 1. ... 2. ... 3. ...
Mong đợi: ...
Thực tế: ...
HTTP status / body / Console / log: ...
Ảnh gốc và truth nếu là lỗi OMR: ...
Code cần kiểm tra: Mxx, file, hàm, dòng ...
Kết quả test lại sau sửa: ...
```

### 20.3. Những gì đã xác minh khi lập tài liệu

- Đã đọc và đối chiếu router, schema, service, lõi OMR, trang frontend và ba test function hiện có để xây dựng các ca trên.
- Đã thử chạy `python -m pytest tests -q` ngày 11/11/2026; PowerShell báo **không tìm thấy lệnh `python`**. Chưa chạy được pytest trong phiên này; không có kết luận 3 test đã Pass.
- Đã kiểm tra cú pháp Python và lệnh `--help` của `tools.generate_manual`; chưa chạy sinh ảnh vì Python sẵn có trong phiên công cụ thiếu `cv2`. Chạy script bằng môi trường đã cài `requirements.txt` của hệ thống.
- Chưa kiểm tra UI, webcam, bản in hoặc tập ảnh thật. Các ca đó mặc định **Not run**.
- Các điểm GAP là nhận xét từ mã nguồn để dẫn hướng kiểm thử; cần tái hiện trước khi ghi thành lỗi đã xác nhận.
