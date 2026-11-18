# Quy trình xử lý ảnh 12 bước: từ ảnh phiếu trắc nghiệm đến kết quả chấm bài

Tài liệu giải thích quy trình đang dùng trong dự án **OMR Exam**, theo đúng thứ tự 12 bước của màn hình **Phòng thí nghiệm xử lý ảnh**. Mỗi bước trình bày mục đích, cách xử lý, đầu ra, ví dụ và lý thuyết cần biết.

**OMR (Optical Mark Recognition)** là nhận dạng dấu tô tại các vị trí đã biết trên phiếu. Trong dự án này, chương trình đo độ sáng bên trong ô tròn để suy ra ô nào đã được tô. SBD và mã đề cũng được đọc từ các cột ô tô, không phải bằng nhận dạng chữ viết tay.

**Cần phân biệt hai kết quả:** sau 12 bước ở Phòng thí nghiệm, hệ thống có SBD, mã đề, các đáp án và cảnh báo. Để có **điểm số và trạng thái bài làm**, luồng chấm bài tiếp tục đối chiếu đáp án chuẩn, ghép thí sinh và kiểm tra nghiệp vụ. Phần cuối tài liệu giải thích đầy đủ đoạn này.

## 1. Bối cảnh: chương trình đã biết gì trước khi nhận ảnh?

Hệ thống tự sinh phiếu nên đã biết bố cục của phiếu trong [omr/layout.py](../omr/layout.py):

| Thành phần | Thông tin đã biết |
|---|---|
| Tờ phiếu | A4 dọc, rộng 210 mm, cao 297 mm |
| Marker định vị | Bốn hình vuông cạnh 8 mm, tâm cách mép giấy 11 mm |
| Chiều của phiếu | Marker trên trái có lỗ trắng, khác ba marker còn lại |
| Số báo danh | Sáu cột chữ số; mỗi cột có các lựa chọn từ 0 đến 9 |
| Mã đề | Ba cột chữ số; mỗi cột có các lựa chọn từ 0 đến 9 |
| Phần trả lời | Tọa độ tâm, bán kính và nhãn của từng ô đáp án |
| Cấu hình | Tối đa 120 câu, từ 2 đến 6 phương án A–F |

Nhờ biết bố cục, bài toán được chia thành hai việc: **đưa ảnh chụp về đúng tọa độ của mẫu phiếu**, rồi **đọc dấu tô ở các tọa độ đó**.

Ảnh điện thoại thường có bóng đổ, góc chụp nghiêng, phiếu xoay hoặc giấy hơi cong. Các bước tiền xử lý và căn chỉnh giúp giảm những sai lệch này trước khi quyết định đáp án.

## 2. Bản đồ toàn bộ 12 bước

```text
Ảnh chụp / ảnh quét / trang PDF
    ↓
 1. Ảnh đầu vào
    ↓
 2. Ảnh xám
    ↓
 3. Ước lượng nền giấy
    ↓
 4. Chuẩn hóa độ sáng
    ↓
 5. Nhị phân hóa bằng Otsu
    ↓
 6. Tìm 4 marker góc và xác định chiều phiếu
    ↓
 7. Nắn phối cảnh về phiếu chuẩn
    ↓
 8. Đọc mã QR để lấy cấu hình
    ↓
 9. Căn chỉnh tinh từng khối
    ↓
10. Đo độ sáng từng ô
    ↓
11. Tính ngưỡng phân biệt ô tô và ô trống
    ↓
12. Diễn giải SBD, mã đề, đáp án và cảnh báo
    ↓
Luồng chấm bài: tra đáp án → tính điểm → kiểm tra → lưu / duyệt bài
```

**Cách đọc sơ đồ:** đây là 12 mốc trình bày trên giao diện, không phải 12 hàm chỉ nhận ảnh của bước liền trước. Chẳng hạn, bước 3 tạo ảnh nền để bước 4 dùng cùng ảnh xám; bước 7 nắn ảnh gốc để giữ chi tiết; bước 11 xử lý các con số đo được thay vì tạo ảnh mới.

## 3. Giải thích chi tiết từng bước

### Bước 1. Tiếp nhận ảnh đầu vào

**Mục đích:** biến tệp người dùng tải lên thành dữ liệu ảnh mà OpenCV có thể xử lý.

**Cách thực hiện trong dự án:**

- Với ảnh như JPG hoặc PNG, dùng `cv2.imdecode()` để giải mã thành ma trận điểm ảnh màu BGR.
- Với PDF, dùng PyMuPDF để dựng từng trang thành ảnh ở 200 dpi, sau đó đổi sang BGR.
- Luồng lõi chuẩn hóa ảnh về BGR khi cần, kể cả ảnh xám hoặc ảnh có kênh alpha.

**Lý thuyết cần biết:** một ảnh số là một ma trận điểm ảnh, còn gọi là pixel. Ảnh màu thường có ba kênh. OpenCV dùng thứ tự BGR: xanh dương, xanh lá, đỏ. Với ảnh 8 bit, mỗi giá trị kênh nằm trong khoảng 0–255.

Ví dụ, ảnh rộng 3.000 pixel, cao 4.000 pixel có ma trận dạng `4000 × 3000 × 3`. Đây mới là các giá trị màu; chương trình chưa biết vùng nào là phiếu hay ô đáp án.

**Đầu ra:** ảnh gốc dưới dạng ma trận, kèm kích thước ảnh.

**Lưu ý về hai màn hình:** Phòng thí nghiệm chỉ lấy trang đầu khi tải PDF. Luồng tải bài để chấm xử lý danh sách ảnh của các trang.

**Mã nguồn:** `load_image_bytes()` trong [omr/pipeline.py](../omr/pipeline.py), `to_bgr()` trong [omr/preprocess.py](../omr/preprocess.py).

### Bước 2. Chuyển sang ảnh xám

**Mục đích:** giữ lại thông tin sáng tối để phát hiện nét mực và hình dạng, đồng thời giảm dữ liệu cần xử lý.

Ảnh màu có ba giá trị cho mỗi pixel. Ảnh xám chỉ có một giá trị: gần 0 là tối, gần 255 là sáng. Phiếu được in chủ yếu bằng mực đen trên giấy trắng nên thông tin này phù hợp cho việc nhận dạng.

**Cách thực hiện:** dùng `cv2.cvtColor()` với phép đổi BGR sang xám. Công thức mức xám tương ứng là:

```text
Y ≈ 0,299R + 0,587G + 0,114B
```

Trong đó R, G, B là ba thành phần màu. Trọng số của màu xanh lá lớn hơn vì công thức phản ánh độ nhạy sáng của thị giác.

Sau đó, ảnh dùng để **phát hiện marker** được thu nhỏ nếu cạnh dài nhất vượt 1.600 pixel. Ảnh gốc vẫn được giữ để nắn ở bước sau.

**Ví dụ:** ảnh `3000 × 4000` được thu còn khoảng `1200 × 1600` cho giai đoạn phát hiện. Số pixel giảm từ 12 triệu xuống khoảng 1,92 triệu.

**Đầu ra:** ảnh xám và hệ số thu nhỏ. Hệ số này giúp quy đổi tọa độ marker tìm được trở lại ảnh gốc.

**Mã nguồn:** `to_gray()`, `limit_size()` trong [omr/preprocess.py](../omr/preprocess.py); `DETECT_MAX_SIDE` trong [omr/alignment.py](../omr/alignment.py).

### Bước 3. Ước lượng nền giấy

**Mục đích:** ước lượng độ sáng của giấy tại mỗi vị trí nếu không có chữ, marker và dấu tô.

Hãy hình dung một nửa tờ giấy nằm dưới bóng tay. Phần giấy đó có thể tối dù hoàn toàn chưa tô. Chương trình cần biết đâu là tối do ánh sáng, đâu là tối do mực.

**Cách thực hiện trong dự án:**

1. Thu ảnh xám còn khoảng một phần tư chiều rộng và chiều cao để tăng tốc.
2. Tạo phần tử cấu trúc hình elip đủ lớn so với các chi tiết mực cần loại bỏ.
3. Áp dụng phép **đóng hình thái học**.
4. Làm mượt bằng Gaussian để giữ xu hướng biến thiên chậm của ánh sáng.
5. Phóng ảnh nền về kích thước ảnh xám đang xử lý.

**Lý thuyết liên quan:** phép đóng là **giãn rồi co**. Trên ảnh xám, giãn lấy giá trị lớn nhất trong lân cận, còn co lấy giá trị nhỏ nhất. Với nền sáng và nét mực tối nhỏ hơn phần tử cấu trúc, phép đóng có thể lấp các chi tiết tối, giúp ước lượng nền. [Tài liệu hình thái học OpenCV](https://docs.opencv.org/4.13.0/d9/d61/tutorial_py_morphological_ops.html).

```text
Đóng(I, K) = Co(Giãn(I, K), K)
```

Ở đây `I` là ảnh xám, `K` là phần tử cấu trúc, có thể hiểu là cửa sổ dùng để xét các pixel lân cận.

**Đầu ra:** ảnh nền `B(x, y)`, thể hiện vùng giấy được chiếu sáng mạnh hay yếu. Đây là một ước lượng; vết tối quá lớn vẫn có thể ảnh hưởng đến kết quả.

**Mã nguồn:** `estimate_background()` trong [omr/preprocess.py](../omr/preprocess.py).

### Bước 4. Chuẩn hóa độ sáng

**Mục đích:** làm nền giấy sáng đồng đều hơn để bóng đổ ít bị nhầm thành dấu tô.

**Cách thực hiện:** chia ảnh xám cho ảnh nền vừa ước lượng, nhân 255, rồi giới hạn kết quả trong khoảng 0–255:

```text
I_chuẩn(x, y) = clip(255 × I_xám(x, y) / max(B(x, y), 1), 0, 255)
```

`max(B, 1)` tránh chia cho 0; `clip` giữ giá trị trong khoảng hợp lệ.

**Ví dụ minh họa:**

| Vị trí | Giá trị ảnh xám | Nền ước lượng | Sau chuẩn hóa |
|---|---:|---:|---:|
| Giấy trắng ở vùng sáng | 230 | 230 | 255 |
| Giấy trắng ở vùng bị bóng | 140 | 140 | 255 |
| Dấu tô ở vùng bị bóng | 45 | 140 | Khoảng 82 |

Sau phép chia, hai vùng giấy cùng trở nên sáng, còn dấu tô vẫn tối.

**Lý thuyết liên quan:** có thể hình dung ảnh quan sát gần đúng bằng tích của **ánh sáng chiếu tới** và **đặc tính phản xạ của bề mặt**. Chia cho nền là cách giảm thành phần ánh sáng biến thiên chậm. Đây là mô hình gần đúng, không khôi phục được chi tiết đã mất vì lóa trắng hoặc nhòe nặng.

**Đầu ra:** ảnh xám đã chuẩn hóa ánh sáng. Bước này vẫn giữ nhiều mức xám, chưa chuyển thành ảnh hai màu.

**Mã nguồn:** `normalize_illumination()` trong [omr/preprocess.py](../omr/preprocess.py).

### Bước 5. Nhị phân hóa bằng Otsu và khử nhiễu

**Mục đích:** tạo ảnh chỉ gồm hai giá trị để dễ tìm đường bao của các đối tượng mực.

**Cách thực hiện trong dự án:**

1. Làm mượt ảnh chuẩn hóa bằng bộ lọc Gaussian `3 × 3`.
2. Tính ngưỡng Otsu từ phân bố mức xám.
3. Kẹp ngưỡng vào khoảng **60–150** để ổn định việc phát hiện.
4. Áp dụng ngưỡng đảo: pixel tối được biểu diễn bằng 255, pixel sáng bằng 0.
5. Thực hiện phép mở hình thái với phần tử `2 × 2` để giảm nhiễu hạt.

```text
Nếu I(x, y) ≤ T: ảnh nhị phân = 255  → vùng mực
Nếu I(x, y) > T: ảnh nhị phân = 0    → vùng nền
```

Do có bước kẹp, **ngưỡng thực dùng có thể khác ngưỡng Otsu ban đầu**.

**Lý thuyết Otsu:** thử các ngưỡng để chia histogram mức xám thành hai lớp, chọn ngưỡng làm tổng phương sai trong lớp nhỏ nhất; tương đương làm phương sai giữa hai lớp lớn nhất. [Tài liệu ngưỡng hóa OpenCV](https://docs.opencv.org/4.12.0/d7/d4d/tutorial_py_thresholding.html).

**Lý thuyết phép mở:** mở là **co rồi giãn**. Trên ảnh nhị phân có vùng mực màu trắng, phép này giúp loại các thành phần trắng rất nhỏ. [Tài liệu hình thái học OpenCV](https://docs.opencv.org/4.13.0/d9/d61/tutorial_py_morphological_ops.html).

**Ví dụ:** với ngưỡng 120, pixel có mức xám 70 trở thành 255, còn pixel 240 trở thành 0. Việc đảo màu giúp hàm tìm contour làm việc trên các vùng mực như đối tượng tiền cảnh.

**Đầu ra:** ảnh nhị phân phục vụ tìm marker, không phải danh sách đáp án.

**Mã nguồn:** `binarize_dark()` trong [omr/preprocess.py](../omr/preprocess.py), `_detect_markers_on()` trong [omr/alignment.py](../omr/alignment.py).

### Bước 6. Tìm bốn marker góc và xác định chiều phiếu

**Mục đích:** xác định vị trí tờ phiếu trong ảnh và thứ tự bốn góc của phiếu.

Marker là bốn hình vuông in sẵn. Chúng đóng vai trò như bốn mốc để chương trình biết tờ giấy đã bị nghiêng, xoay hoặc thu nhỏ như thế nào.

**Phần A — tìm ứng viên:** dùng `findContours()` để tìm đường bao, rồi giữ những đối tượng thỏa các điều kiện chính:

- Diện tích nằm trong khoảng phù hợp với kích thước ảnh.
- Tỉ lệ cạnh ngắn/cạnh dài của hình chữ nhật bao xoay ít nhất 0,6.
- Độ đặc ít nhất 0,9: diện tích contour gần với diện tích bao lồi.
- Xấp xỉ đường bao thành đa giác có bốn đỉnh.
- Diện tích đa giác xấp xỉ đạt ít nhất 86% diện tích contour.

```text
Độ đặc = diện tích contour / diện tích bao lồi
```

Các kiểm tra này giúp phân biệt marker vuông với ô tròn đã tô, chữ in và nhiễu.

**Phần B — chọn bộ bốn điểm:** chương trình xét các tổ hợp từ tối đa 18 ứng viên lớn nhất, kiểm tra tứ giác lồi, độ tương đồng kích thước marker và tính hợp lý của các cạnh. Khoảng cách giữa tâm marker trên phiếu là **188 × 275 mm**, khác với kích thước cả tờ A4.

Các bộ hợp lệ được ưu tiên theo diện tích tứ giác lớn, rồi **nắn thử và kiểm chứng với hình mẫu cố định**. Hình mẫu gồm marker và các thành phần như khối SBD, mã đề. Vì vậy, không chỉ cần tìm được bốn hình vuông là đủ.

**Xác định chiều:** marker rỗng ở góc trên trái là một phần của hình mẫu bất đối xứng. Chương trình thử cách sắp thứ tự góc và chọn hướng khớp mẫu tốt nhất, từ đó nhận biết phiếu xoay 0°, 90°, 180° hoặc 270°. Không nên hiểu rằng mã hiện tại chỉ kiểm tra riêng lỗ trắng rồi quyết định chiều.

**Nếu không tìm được marker trực tiếp:**

1. Dùng Canny và contour để tìm tứ giác mép giấy.
2. Nắn sơ bộ, rồi thử tìm marker một lần nữa.
3. Nếu vẫn không thấy marker, có thể dùng mép giấy nếu kiểm chứng đạt yêu cầu, đồng thời thêm cảnh báo.
4. Nếu không tìm được khung hợp lệ hoặc kiểm chứng thất bại, trả lỗi.

**Đầu ra:** bốn điểm tham chiếu theo thứ tự trên trái, trên phải, dưới phải, dưới trái; ma trận biến đổi, góc xoay, cách căn chỉnh và điểm khớp mẫu.

**Mã nguồn:** `find_marker_candidates()`, `marker_quads()`, `select_markers()`, `find_page_quad()`, `align()` trong [omr/alignment.py](../omr/alignment.py).

### Bước 7. Nắn phối cảnh về phiếu chuẩn

**Mục đích:** đưa ảnh chụp nghiêng về một ảnh phiếu nhìn thẳng, có kích thước và tọa độ cố định.

Ví dụ, chụp một tờ giấy từ bên cạnh làm mép trên nhìn ngắn hơn mép dưới. Chỉ xoay ảnh không giải quyết được sự biến dạng này. Chương trình phải dùng **biến đổi phối cảnh**.

**Cách thực hiện:** ghép bốn điểm tham chiếu trên ảnh gốc với bốn tọa độ tương ứng trên phiếu chuẩn. Dùng `cv2.getPerspectiveTransform()` để tìm ma trận **homography H**, rồi dùng `cv2.warpPerspective()` để tạo ảnh mới.

**Lý thuyết liên quan:** homography là ma trận `3 × 3` biểu diễn phép ánh xạ phối cảnh giữa hai mặt phẳng. Bốn cặp điểm tương ứng ở cấu hình không suy biến cho phép xác định phép biến đổi. [Tài liệu biến đổi hình học OpenCV](https://docs.opencv.org/4.5.3/da/d6e/tutorial_py_geometric_transformations.html).

```text
u = (h11×x + h12×y + h13) / (h31×x + h32×y + h33)
v = (h21×x + h22×y + h23) / (h31×x + h32×y + h33)
```

`(x, y)` là điểm trên ảnh chụp; `(u, v)` là điểm trên phiếu chuẩn. Các hệ số `h` nằm trong ma trận H.

**Kích thước đầu ra mặc định:**

```text
Độ phân giải = 6 pixel/mm
Chiều rộng  = 210 × 6 = 1260 pixel
Chiều cao   = 297 × 6 = 1782 pixel
```

Sau bước này, một ô có tọa độ `(112 mm, 50 mm)` trên mẫu sẽ nằm quanh `(672 px, 300 px)` trên ảnh chuẩn.

**Chi tiết quan trọng:** khi dùng marker, đích ánh xạ là tọa độ **tâm marker trong phiếu**, không phải bốn góc ngoài của ảnh. Nhờ vậy các lề giấy vẫn được giữ đúng.

**Giới hạn:** homography phù hợp với mặt phẳng. Giấy cong có thể còn lệch cục bộ; bước 9 sẽ bù một phần sai lệch đó.

**Đầu ra:** ảnh phiếu chuẩn `1260 × 1782` pixel với cấu hình mặc định.

**Mã nguồn:** `_marker_homography()`, `warp()` trong [omr/alignment.py](../omr/alignment.py).

### Bước 8. Đọc mã QR để lấy cấu hình phiếu

**Mục đích:** biết tờ phiếu được in cho kỳ thi nào, có bao nhiêu câu và bao nhiêu phương án mỗi câu.

**Cách thực hiện:** chương trình dùng ma trận H để nắn riêng vùng QR từ ảnh gốc ở độ phân giải **12 pixel/mm**. Nó thử giải mã ảnh vùng này, rồi thử thêm bản nhị phân Otsu nếu cần, bằng `cv2.QRCodeDetector()`.

Việc nắn riêng từ ảnh gốc giúp tận dụng chi tiết của QR còn có trong ảnh gốc. Nâng độ phân giải đầu ra không khôi phục được các chi tiết vốn đã mất khi chụp.

**Nội dung QR trong dự án:**

```text
OMRX|phiên_bản_bố_cục|mã_kỳ_thi|số_câu|số_phương_án
```

Ví dụ:

```text
OMRX|1|7|40|4
```

Được diễn giải thành bố cục phiên bản 1, kỳ thi số 7, 40 câu, mỗi câu 4 phương án.

**Cần phân biệt:** `mã_kỳ_thi` trong QR là định danh kỳ thi trong hệ thống. **Mã đề**, chẳng hạn `101`, được đọc từ ba cột ô tô ở bước 12. QR này không chứa đáp án đúng và không tự cho biết điểm.

**Nếu không đọc được QR:** dùng cấu hình đã cung cấp từ kỳ thi hoặc nhập tay. Trong Phòng thí nghiệm, nếu không đọc được QR và cũng chưa có số câu, quá trình dừng với yêu cầu nhập số câu. Số phương án mặc định là 4 khi không có giá trị khác.

Trong luồng chấm bài, nếu QR chỉ sang kỳ thi khác, chương trình thêm cờ `mismatch`. Việc chọn cấu hình còn xét kỳ thi đang chấm; không phải mọi QR đọc được đều được ưu tiên vô điều kiện.

**Đầu ra:** thông tin QR nếu đọc được và bố cục ô tương ứng với số câu, số phương án cần đọc.

**Mã nguồn:** `decode_qr_from()`, `process_image()` trong [omr/pipeline.py](../omr/pipeline.py); `encode_qr()`, `decode_qr()`, `build_layout()` trong [omr/layout.py](../omr/layout.py).

### Bước 9. Căn chỉnh tinh từng khối

**Mục đích:** bù sai lệch nhỏ còn lại giữa tọa độ ô trên mẫu và vị trí thực của ô trong ảnh đã nắn.

Nắn phối cảnh đưa cả tờ giấy về khung chung, nhưng giấy cong hoặc nhăn vẫn có thể làm một khối câu hỏi lệch vài pixel. Nếu cứ lấy mẫu đúng tọa độ lý thuyết, vùng đo có thể rơi vào viền ô hoặc bỏ sót nét tô.

**Cách thực hiện trong dự án:**

1. Chuẩn hóa ánh sáng lần nữa trên ảnh phiếu đã nắn, với tham số phù hợp cho giai đoạn đọc ô.
2. Tạo ảnh mực bằng `255 − ảnh_chuẩn_hóa` rồi làm mượt nhẹ.
3. Vẽ hình mẫu cho từng khối, gồm khung và các vòng tròn đã biết tọa độ.
4. Tìm vị trí khớp nhất trong phạm vi **±2,5 mm**, tương đương khoảng **±15 pixel** ở 6 pixel/mm.
5. Lấy độ dịch chuyển `(dx, dy)` và cộng vào tọa độ các ô trong khối đó.

**Lý thuyết liên quan:** template matching trượt một ảnh mẫu trên vùng tìm kiếm và tính mức giống nhau ở từng vị trí. Dự án dùng `TM_CCOEFF_NORMED`, phương pháp tương quan đã trừ trung bình và chuẩn hóa. Điểm lớn hơn thể hiện mức khớp tốt hơn. [Tài liệu so khớp mẫu OpenCV](https://docs.opencv.org/4.11.0/d4/dc6/tutorial_py_template_matching.html).

**Ví dụ:** một khối có kết quả `dx = +4 px`, `dy = −3 px`. Toàn bộ tâm ô trong khối được dịch sang phải 4 pixel và lên trên 3 pixel trước khi đo.

Nếu điểm khớp nhỏ hơn **0,25**, mã hiện tại giữ dịch chuyển `(0, 0)` thay vì áp dụng độ lệch vừa tìm được. Trên hình minh họa, khung đỏ là vị trí lý thuyết, khung xanh là vị trí sau căn chỉnh.

**Giới hạn:** mỗi khối chỉ được bù bằng một phép dịch chuyển chung. Bước này không làm phẳng hoàn toàn giấy cong và không sửa mọi biến dạng bên trong khối.

**Đầu ra:** độ dịch chuyển và điểm khớp của từng khối; tọa độ tâm ô đã hiệu chỉnh.

**Mã nguồn:** `_render_block_template()`, `align_block()`, `read_bubbles()` trong [omr/reader.py](../omr/reader.py).

### Bước 10. Đo độ sáng từng ô

**Mục đích:** chuyển hình ảnh mỗi ô thành một con số để có thể quyết định ô đã tô hay còn trống.

**Cách thực hiện:** tại tâm ô sau căn chỉnh, lấy một vùng đĩa tròn nhỏ nằm bên trong ô rồi tính trung bình mức xám của các pixel thuộc vùng đó. Dữ liệu đo lấy từ ảnh xám đã chuẩn hóa sau nắn, không lấy trực tiếp từ ảnh nhị phân bước 5.

```text
Bán kính vùng đo = 0,62 × bán kính ô
V = tổng mức xám của các pixel trong vùng đo / số pixel trong vùng đo
```

**Vì sao chỉ đo phần lõi?** Viền ô là mực in đen có sẵn kể cả khi chưa tô. Bỏ phần viền giúp giảm ảnh hưởng của nét in và sai lệch tọa độ nhỏ. Con số 62% là **tỉ lệ bán kính**, tương ứng khoảng `0,62² = 38,44%` diện tích hình tròn, không phải 62% diện tích ô.

Với ô đáp án bán kính 2,1 mm, ở 6 pixel/mm:

```text
Bán kính cả ô ≈ 12,6 pixel
Bán kính lõi đo ≈ 7,81 pixel
```

**Ví dụ một câu có bốn phương án:**

| Phương án | Độ sáng trung bình minh họa | Nhận xét ban đầu |
|---|---:|---|
| A | 242 | Sáng, có khả năng còn trống |
| B | 58 | Tối, có khả năng đã tô |
| C | 238 | Sáng, có khả năng còn trống |
| D | 245 | Sáng, có khả năng còn trống |

Bước này mới **đo**, chưa chính thức quyết định chọn B. Quyết định phải dựa vào ngưỡng ở bước 11.

**Số ô cần đo:** SBD có `6 × 10 = 60` ô, mã đề có `3 × 10 = 30` ô. Phiếu 40 câu, mỗi câu 4 phương án có tổng cộng:

```text
60 + 30 + 40 × 4 = 250 ô
```

Ảnh bản đồ màu ở Phòng thí nghiệm biểu diễn ô tối bằng sắc đỏ và ô sáng bằng sắc xanh. Màu này thể hiện **độ sáng đo được**, không cho biết đáp án đúng hay sai.

**Đầu ra:** các giá trị độ sáng, tọa độ tâm và bán kính của từng ô.

**Mã nguồn:** `_disk_mask()`, `_mean_in_disk()`, `read_bubbles()` trong [omr/reader.py](../omr/reader.py).

### Bước 11. Tính ngưỡng phân biệt ô tô và ô trống

**Mục đích:** tìm ranh giới giữa nhóm ô tối và nhóm ô sáng, rồi xác định ô nào được tô.

**Ý tưởng dễ hiểu:** gom các giá trị đo ở bước 10, sắp từ tối đến sáng. Nếu phiếu có ô tô rõ, dãy thường có một nhóm giá trị thấp và một nhóm giá trị cao. Khoảng cách lớn giữa hai nhóm là dấu hiệu để đặt ngưỡng.

#### Ngưỡng toàn cục

Hàm `find_jump_threshold()` tìm bước nhảy lớn nhất và đặt ngưỡng ở giữa hai giá trị tạo ra bước nhảy. Dự án kế thừa ý tưởng này từ OMRChecker.

**Chi tiết đúng với mã hiện tại:** khi tìm ngưỡng toàn cục bằng cấu hình mặc định, chương trình so sánh `q[i+2] − q[i]` trên dãy đã sắp xếp, thay vì chỉ so hai phần tử liền kề. Đây là cách nới khoảng so sánh để chịu nhiễu.

Ví dụ đơn giản:

```text
Dãy đã sắp xếp: 45, 55, 65, 235, 240, 245
Các khoảng so:  20, 180, 175, 10
Bước nhảy lớn nhất = 235 − 55 = 180
Ngưỡng toàn cục   = (55 + 235) / 2 = 145
```

Với ngưỡng 145, các giá trị 45, 55, 65 thuộc nhóm tối; 235, 240, 245 thuộc nhóm sáng.

Mặc định, chỉ công nhận bước nhảy **lớn hơn 25**. Nếu không tìm được, hàm trả ngưỡng dự phòng **175** và bước nhảy bằng 0. Đây không phải bằng chứng phiếu đã được nhận dạng chắc chắn; hệ thống sẽ thêm cảnh báo về phiếu trống hoặc ảnh quá mờ.

#### Ngưỡng cục bộ cho từng câu hoặc từng cột chữ số

Độ đậm của bút có thể thay đổi giữa các câu. Vì vậy, chương trình tìm thêm ngưỡng cục bộ bằng các giá trị trong từng nhóm ô, lần này so các phần tử liền kề và yêu cầu bước nhảy **lớn hơn 30**.

Để hạn chế ngưỡng cục bộ thay đổi quá xa, nó bị kẹp vào dải:

```text
T_toàn_cục − 0,22 × J_tham_chiếu
             đến
T_toàn_cục + 0,22 × J_tham_chiếu
```

`J_tham_chiếu` là bước nhảy toàn cục nếu có; nếu bước nhảy bằng 0, mã dùng giá trị dự phòng 80 cho các phép tính dải.

**Quy tắc cuối cùng:**

```text
V < T_cục_bộ  → đánh dấu là ô đã tô
V ≥ T_cục_bộ  → đánh dấu là ô trống
```

#### Phát hiện ô không chắc chắn

Ngoài quyết định tô/trống, chương trình gắn dấu không chắc chắn khi:

- Một giá trị nằm sát ngưỡng: khoảng cách nhỏ hơn `max(6; 0,14 × J_tham_chiếu)`.
- Một ô được coi là trống nhưng tối bất thường so với mức sáng điển hình của các ô trống, có thể do vết tẩy hoặc tô rất mờ.

Mức sáng ô trống điển hình được ước lượng bằng **trung vị** các giá trị không nhỏ hơn ngưỡng toàn cục. Trung vị là giá trị giữa của dãy đã sắp, giúp giảm ảnh hưởng của một vài giá trị lệch.

**Phân biệt với bước 5:**

| Nội dung | Bước 5: Otsu | Bước 11: bước nhảy lớn nhất |
|---|---|---|
| Dữ liệu đầu vào | Mức xám của các pixel | Độ sáng trung bình của từng lõi ô |
| Mục đích | Tạo ảnh nhị phân để tìm marker | Quyết định ô tô hay trống |
| Cách tìm ngưỡng | Thống kê histogram mức xám | Khoảng cách trong dãy giá trị ô đã sắp xếp |
| Kết quả | Một ảnh nhị phân | Nhãn tô/trống và độ không chắc chắn cho từng nhóm |

**Đầu ra:** ngưỡng toàn cục, bước nhảy, ngưỡng từng nhóm, danh sách ô được tô và dấu không chắc chắn.

**Mã nguồn:** `ReaderConfig`, `find_jump_threshold()`, `read_bubbles()` trong [omr/reader.py](../omr/reader.py).

### Bước 12. Diễn giải SBD, mã đề, đáp án và tạo kết quả nhận dạng

**Mục đích:** biến danh sách ô tô thành dữ liệu có ý nghĩa cho người dùng và luồng chấm bài.

#### Đọc SBD và mã đề

Mỗi cột chữ số có 10 ô tương ứng 0–9. Chương trình đọc lần lượt các cột rồi ghép thành chuỗi.

Ví dụ, sáu cột SBD lần lượt chọn `0, 0, 0, 1, 2, 3` cho kết quả **`000123`**. Giữ dưới dạng chuỗi giúp không mất các số 0 ở đầu. Ba cột mã đề chọn `1, 0, 1` cho kết quả **`101`**.

| Tình huống trong một cột | Cách xử lý hiện tại |
|---|---|
| Đúng một ô được tô | Đọc chữ số của ô đó; thêm cờ nếu không chắc chắn |
| Không có ô được tô | Ghi `?` và thêm cờ `blank` |
| Nhiều ô được tô, ô tối nhất vượt trội | Chọn ô tối nhất nếu chênh với ô tối thứ hai lớn hơn 40 mức xám; thêm cờ `uncertain` |
| Nhiều ô được tô, không có ô vượt trội | Ghi `*` và thêm cờ `multiple` |

#### Đọc đáp án từng câu

Ghép nhãn của các ô được tô trong câu:

| Kết quả đo | Giá trị đáp án |
|---|---|
| Chỉ ô B được tô | `"B"` |
| Cả A và C được tô | `"AC"` |
| Không có ô được tô | `""`, tức chuỗi rỗng |

Trong mã hiện tại, câu tô nhiều ô có cờ `multiple`; câu không chắc chắn có cờ `uncertain` nếu không rơi vào nhánh nhiều ô. **Câu trả lời bỏ trống rõ ràng không tự động có cờ `blank`**; cờ này được tạo khi thiếu chữ số SBD hoặc mã đề. Câu bỏ trống vẫn được lưu bằng chuỗi rỗng và tính sai khi chấm.

#### Ước lượng độ tin cậy

Chương trình tính một chỉ số dựa trên tỉ lệ nhóm ô không chắc chắn và độ tách biệt tối/sáng:

```text
c = min(1; bước_nhảy_toàn_cục / 60)
confidence = max(0; (1 − số_nhóm_không_chắc / tổng_số_nhóm) × (0,5 + 0,5 × c))
```

Các nhóm bao gồm từng cột chữ số SBD, mã đề và từng câu trả lời. Nếu chỉ căn chỉnh theo mép giấy, kết quả trên được nhân thêm **0,7**.

Đây là **chỉ số kinh nghiệm trong chương trình**, không phải xác suất đã được hiệu chuẩn. Giá trị 95% không có nghĩa hệ thống đã chứng minh xác suất toàn bộ bài đúng là 95%. Việc chuyển bài sang duyệt dựa trên các cờ cần xử lý, không chỉ dựa vào chỉ số này.

#### Tạo đầu ra

Kết quả nhận dạng bao gồm:

- `ok`, `error`: xử lý thành công hay lỗi.
- `sbd`, `exam_code`: SBD và mã đề đọc được.
- `answers`: các đáp án theo thứ tự câu.
- `flags`, `confidence`: cảnh báo và chỉ số tin cậy.
- Thông tin QR, cấu hình phiếu, cách căn chỉnh, góc xoay, ngưỡng và thời gian xử lý.
- Ảnh phiếu đã nắn và ảnh có lớp đánh dấu phục vụ kiểm tra.

Trong Phòng thí nghiệm, chưa có đáp án chuẩn truyền vào hàm vẽ nên các ô đáp án đã chọn được tô lớp màu xám; SBD/mã đề được đánh dấu xanh dương; câu nhiều ô hoặc không chắc chắn có thể có khung cam. **Lớp đánh dấu ở đây chưa kết luận đúng/sai.**

**Mã nguồn:** `_decode_digits()`, `process_image()`, `OMRResult.summary()` trong [omr/pipeline.py](../omr/pipeline.py); `annotate()` trong [omr/visualize.py](../omr/visualize.py).

## 4. Từ kết quả nhận dạng đến điểm số cuối cùng

Phần này là nghiệp vụ sau nhận dạng, không phải các bước bổ sung vào danh sách 12 bước của Phòng thí nghiệm.

### 4.1. Ghép đúng thí sinh và đáp án chuẩn

Luồng chấm bài lấy SBD để tìm thí sinh trong **kỳ thi đang chấm**, đồng thời kiểm tra có bài khác trùng SBD hay không. Nếu kỳ thi có danh sách thí sinh mà SBD không khớp ai, bài được gắn cờ để kiểm tra.

Tiếp theo, chương trình tra đáp án bằng **mã kỳ thi + mã đề**. Chẳng hạn, mã đề `101` của kỳ thi này không được tự động dùng đáp án `101` của kỳ thi khác.

Nếu chưa có đáp án hoặc không tìm thấy mã đề tương ứng, chương trình để `score = None`, tức **chưa tính được điểm**, và gắn cờ. Trường hợp này khác với bài có điểm 0.

### 4.2. So sánh từng câu và tính điểm

Với đáp án chuẩn đơn lựa chọn, câu chỉ đúng khi chuỗi đáp án nhận dạng trùng hoàn toàn với đáp án chuẩn và đáp án chuẩn không rỗng. Câu bỏ trống hoặc tô nhiều ô tính sai.

```text
Điểm = làm_tròn_2_chữ_số(thang_điểm × số_câu_đúng / số_câu_trong_đáp_án)
```

Trong luồng chấm, đáp án chuẩn được lấy tối đa theo số câu của kỳ thi. Với cấu hình hợp lệ có đủ đáp án, mẫu số chính là số câu của kỳ thi. Cách chấm hiện tại cho mỗi câu trọng số bằng nhau, không trừ điểm câu sai.

**Ví dụ giả định:**

```text
SBD đọc được:       000123
Mã đề đọc được:     101
Số câu:            40
Số câu đúng:       32
Thang điểm:        10
Điểm:              10 × 32 / 40 = 8,00
```

Đây là ví dụ giải thích công thức, không phải kết quả đo trên một ảnh cụ thể.

### 4.3. Quyết định trạng thái bài làm

| Trạng thái | Ý nghĩa |
|---|---|
| `error` | Xử lý ảnh thất bại, chẳng hạn không xác định được phiếu |
| `review` | Đã có dữ liệu nhận dạng nhưng còn cờ cần xử lý |
| `graded` | Không còn cờ chặn cần xử lý; bài đã được chấm |

Những cờ cần xử lý có thể đến từ ảnh hoặc nghiệp vụ: tô nhiều ô, tô mờ, SBD thiếu chữ số, QR sai kỳ thi, SBD lạ, trùng SBD, chưa có đáp án, mã đề không tồn tại.

Cờ có loại `warning` chỉ mang tính thông báo, không tự chuyển bài sang `review`. Chẳng hạn, cảnh báo chỉ căn theo mép giấy không nhất thiết chặn chấm nếu không còn cờ khác.

Một bài ở trạng thái `review` **vẫn có thể đã có điểm tính được**. Điểm đó cần được xem cùng cảnh báo trước khi sử dụng làm kết quả cuối.

### 4.4. Lưu, kiểm tra và duyệt kết quả

Luồng chấm lưu ảnh gốc, ảnh đã nắn, ảnh đánh dấu, dữ liệu OMR ban đầu, dữ liệu hiện tại, điểm, cảnh báo và lịch sử thao tác. Dữ liệu OMR ban đầu được giữ để có thể đối chiếu hoặc khôi phục sau khi sửa tay.

Khi có đáp án chuẩn, ảnh chấm dùng các ký hiệu:

- Ô được chọn đúng: xanh lá.
- Ô được chọn sai: đỏ.
- Đáp án đúng bị bỏ lỡ: viền xanh lá.
- SBD và mã đề nhận dạng: xanh dương.
- Câu cần xem lại: có thể được bao khung cam.

Người chấm kiểm tra các bài cần duyệt, sửa SBD/mã đề/đáp án khi cần và xác nhận đã duyệt. Hệ thống tính lại điểm và kiểm tra nghiệp vụ; các vấn đề như trùng SBD hoặc thiếu đáp án vẫn cần được giải quyết.

**Đầu ra cuối trong luồng chấm:** bài làm gắn với thí sinh nếu ghép được, mã đề, đáp án từng câu, số câu đúng, điểm số, trạng thái, cảnh báo và ảnh đối chiếu. Khi các vấn đề đã được xử lý, dữ liệu này được dùng ở bảng kết quả và xuất Excel.

**Mã nguồn:** `score_answers()` trong [omr/pipeline.py](../omr/pipeline.py); `grade_image()`, `evaluate()` trong [app/services/grading.py](../app/services/grading.py); thao tác lưu/duyệt trong [app/routers/submissions.py](../app/routers/submissions.py).

## 5. Ví dụ theo dõi một câu qua các bước

Giả sử thí sinh tô B ở câu 1, đáp án chuẩn cũng là B. Các số dưới đây chỉ để minh họa cơ chế.

| Giai đoạn | Chương trình biết được gì? |
|---|---|
| Bước 1–2 | Có một ảnh phiếu và các giá trị sáng tối; chưa biết câu 1 chọn gì |
| Bước 3–4 | Nền sáng đều hơn, vùng tô B vẫn tối |
| Bước 5–6 | Có ảnh nhị phân và các mốc xác định vị trí, chiều phiếu |
| Bước 7 | Phiếu đã ở hệ tọa độ chuẩn, có thể tra vị trí câu 1 |
| Bước 8 | Biết phải đọc đúng bố cục của phiếu, ví dụ 40 câu, 4 phương án |
| Bước 9 | Tọa độ lõi ô câu 1 được bù theo độ lệch của khối |
| Bước 10 | Đo được A = 242, B = 58, C = 238, D = 245 |
| Bước 11 | Giả sử ngưỡng cuối của câu là 150: chỉ B nhỏ hơn ngưỡng |
| Bước 12 | Đáp án nhận dạng của câu 1 là `"B"` |
| Chấm điểm | So `"B"` với đáp án chuẩn `"B"`, tính thêm một câu đúng |

Nếu cả B và C cùng thấp hơn ngưỡng, kết quả là `"BC"`, bài có cờ tô nhiều ô và câu này không được tính đúng với đáp án chuẩn `"B"`.

Nếu một giá trị ở sát ngưỡng, chương trình có thể vẫn đọc được đáp án nhưng đánh dấu cần kiểm tra. Việc có đáp án không đồng nghĩa mọi dấu tô đều rõ ràng.

## 6. Những câu hỏi thường gặp khi trình bày quy trình

**Vì sao phải vừa chuẩn hóa sáng vừa nhị phân hóa?** Chuẩn hóa sáng giảm chênh lệch do bóng đổ; nhị phân hóa tạo hai lớp phục vụ tìm đối tượng. Hai thao tác giải quyết hai vấn đề khác nhau.

**Vì sao không đọc đáp án ngay từ ảnh nhị phân?** Đọc trung bình mức xám giữ lại thông tin đậm/nhạt. Thông tin đó cần để phát hiện dấu tô mờ, vết tẩy và giá trị sát ngưỡng, vốn dễ bị mất khi chỉ giữ hai giá trị 0 và 255.

**Vì sao đã nắn toàn phiếu mà còn căn chỉnh từng khối?** Nắn toàn phiếu xử lý phối cảnh chung; dịch từng khối bù sai lệch cục bộ nhỏ. Chúng hỗ trợ nhau nhưng không bảo đảm xử lý được giấy biến dạng mạnh.

**SBD được đọc bằng OCR không?** Không. Chương trình suy ra từng chữ số từ ô tô trong cột 0–9. Tên và các chữ viết tay không nằm trong quy trình nhận dạng này.

**Có dùng mô hình học sâu để đọc ô không?** Pipeline OMR được mô tả ở đây dùng các phép xử lý ảnh và quy tắc OpenCV; không dùng mô hình học sâu để nhận dạng dấu tô. Chatbot của ứng dụng là chức năng riêng.

**Ảnh nào cũng đọc được không?** Không. Mẫu phiếu, mức rõ nét, việc nhìn thấy mốc định vị và chất lượng dấu tô đều ảnh hưởng đến kết quả. Ảnh cắt mất nhiều nội dung, lóa trắng, quá mờ hoặc dùng mẫu khác có thể gây lỗi hay cần duyệt.

**Cảnh báo có đồng nghĩa chắc chắn sai không?** Không. Cảnh báo chỉ ra tình huống cần chú ý; ví dụ dấu tẩy có thể vẫn cho đáp án đúng. Ngược lại, một chỉ số tin cậy cao không thay thế việc kiểm tra các cờ nghiệp vụ.

## 7. Bảng tra nhanh mã nguồn theo 12 bước

| Bước | Khóa trên API Phòng thí nghiệm | Hàm hoặc mô-đun chính |
|---:|---|---|
| 1 | `input` | `omr.pipeline.load_image_bytes()` |
| 2 | `gray` | `omr.preprocess.to_gray()`, `limit_size()` |
| 3 | `background` | `omr.preprocess.estimate_background()` |
| 4 | `normalized` | `omr.preprocess.normalize_illumination()` |
| 5 | `binary` | `omr.preprocess.binarize_dark()`, phép mở hình thái |
| 6 | `markers` | `omr.alignment.align()` và các hàm chọn marker |
| 7 | `warped` | `omr.alignment.warp()` |
| 8 | `qr` | `omr.pipeline.decode_qr_from()`, `omr.layout.build_layout()` |
| 9 | `align_blocks` | `omr.reader.align_block()` |
| 10 | `values` | `omr.reader._mean_in_disk()` trong `read_bubbles()` |
| 11 | `threshold` | `omr.reader.find_jump_threshold()`, `read_bubbles()` |
| 12 | `result` | `omr.pipeline.process_image()`, `omr.visualize.annotate()` |

Thứ tự trình bày nằm ở [frontend/src/pages/Lab.tsx](../frontend/src/pages/Lab.tsx); dữ liệu cho các bước được tạo ở [app/routers/lab.py](../app/routers/lab.py).

**Lưu ý khi xem thời gian từng bước:** API Phòng thí nghiệm phục vụ minh họa nên có thực hiện lại một số công đoạn. Ví dụ, `align()` tự chạy tiền xử lý; `read_bubbles()` tính cả căn khối, đo ô và ngưỡng; đến bước kết quả, API gọi lại `process_image()`. Vì thế số mili giây gắn ở từng mốc giao diện không phải phép đo tách biệt, chính xác chi phí riêng của từng thuật toán.

## 8. Tài liệu lý thuyết để đọc thêm

- [OpenCV — Ngưỡng hóa ảnh và Otsu](https://docs.opencv.org/4.12.0/d7/d4d/tutorial_py_thresholding.html): histogram, phân ngưỡng và tự chọn ngưỡng.
- [OpenCV — Phép biến đổi hình thái](https://docs.opencv.org/4.13.0/d9/d61/tutorial_py_morphological_ops.html): giãn, co, mở và đóng.
- [OpenCV — Biến đổi hình học](https://docs.opencv.org/4.5.3/da/d6e/tutorial_py_geometric_transformations.html): biến đổi phối cảnh và nắn ảnh.
- [OpenCV — So khớp mẫu](https://docs.opencv.org/4.11.0/d4/dc6/tutorial_py_template_matching.html): tìm vị trí mẫu khớp nhất trong ảnh.

Các tham số cụ thể như 6 pixel/mm, lõi 62%, ngưỡng dự phòng 175 và biên dịch ±2,5 mm là cấu hình trong mã nguồn dự án; không phải các hằng số bắt buộc của lý thuyết xử lý ảnh.
