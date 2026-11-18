# Triển khai OMR Exam lên VPS Windows

Ứng dụng chạy trên một VPS: React đã build được FastAPI phục vụ cùng API; OpenCV xử lý ảnh; SQLite và ảnh bài làm nằm trên ổ đĩa VPS. Không cần Vercel hoặc dịch vụ DB riêng cho đợt test nhóm nhỏ.

Các script dưới đây được chuẩn bị trong repository, **chưa thực thi trên VPS của bạn**. Chạy lệnh trong PowerShell trên VPS qua Remote Desktop. Ví dụ dùng thư mục `D:\BTLXuLyAnh`; thay đường dẫn nếu ổ đĩa/thư mục thực tế khác. Chạy từng lệnh riêng, không dán toàn bộ thành một dòng.

Thông tin VPS do người dùng cung cấp ngày 11/11/2026:

| Thành phần | Giá trị |
|---|---|
| IP public | `65.108.75.245` |
| Hệ điều hành | Windows Server 2022 Datacenter |
| CPU | AMD Ryzen 7 3700X, 8 nhân / 16 luồng theo ảnh thông tin máy |
| RAM | 65462 MB, khoảng 64 GB |
| Ổ đĩa | C: và D: khoảng 954 GB mỗi ổ |
| Tên miền dùng cho ứng dụng | `vdtcall.site` |

Cấu hình máy phù hợp để bắt đầu test nhóm; số bài chấm đồng thời thực tế vẫn cần đo bằng bộ test. DNS kiểm tra ngày 11/11/2026 đang trả A `216.198.79.1`, khác IP VPS được cung cấp. Cần sửa DNS theo mục 6 trước khi dùng HTTPS trên VPS này.

## 1. Chuẩn bị

- Cài Python 3.12 và Node.js LTS, mở lại PowerShell để nhận PATH.
- Copy hoặc clone mã nguồn vào thư mục riêng trên VPS. Giữ cả `app`, `omr`, `frontend`, `tools`, `deploy`, `requirements.txt` và `run.py`.
- Nếu copy từ máy cá nhân, không copy `.venv` hoặc `frontend/node_modules`; tạo lại chúng trên VPS.
- Dùng ổ đĩa cục bộ cho SQLite; không đặt CSDL trên thư mục mạng.
- Kiểm tra cổng dự định dùng, ví dụ 8000, chưa được ứng dụng khác sử dụng.

```powershell
cd D:\BTLXuLyAnh
python --version
node --version
npm.cmd --version
Get-NetTCPConnection -State Listen -LocalPort 8000 -ErrorAction SilentlyContinue
```

Nếu dòng cuối trả về một tiến trình đang nghe, chọn cổng khác, ví dụ 8010. Các lệnh sau phải dùng thống nhất cổng đó. Không dừng tiến trình của website khác.

## 2. Cài thư viện và build giao diện

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\deploy\windows\prepare.ps1
```

Script tạo `.venv` nếu chưa có, cài `requirements.txt`, kiểm tra thư viện/font PDF, chạy `npm ci` và `npm run build`. Nếu một bước thất bại, script dừng kèm thông báo; sửa lỗi đó trước khi chạy tiếp. Script không mở firewall hoặc tạo tác vụ nền.

Nếu Python không nằm trong PATH, truyền đường dẫn đã cài trên VPS, ví dụ:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\deploy\windows\prepare.ps1 -PythonExecutable "C:\Python312\python.exe"
```

Đường dẫn trên chỉ là ví dụ; dùng đúng vị trí cài Python của VPS.

**Font PDF:** code tìm Arial trong `C:\Windows\Fonts`; trên Windows cài tối giản có thể thiếu. Nhánh dự phòng hiện có là DejaVuSans do matplotlib cung cấp. Nếu script báo thiếu font, có thể cài vào chính môi trường ứng dụng rồi chạy prepare lại:

```powershell
.\.venv\Scripts\python.exe -m pip install matplotlib
```

## 3. Chạy thử và khởi tạo admin

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\deploy\windows\start.ps1
```

Lần đầu nếu chưa có `data/app.db` và chưa đặt `OMR_ADMIN_PASSWORD`, script hỏi mật khẩu admin mới, tối thiểu 6 ký tự. Mật khẩu không được hiển thị khi nhập và không được ghi vào file script hoặc transcript. Tài khoản mặc định là `admin`, trừ khi bạn đã đặt `OMR_ADMIN_USER`.

Mở trình duyệt **trên VPS**:

```text
http://127.0.0.1:8000
http://127.0.0.1:8000/api/health
```

Health phải trả `{"ok":true}`. Đăng nhập, tạo một kỳ thi, tải PDF và chấm một ảnh để kiểm tra đủ thư viện và font. Mở terminal khác để kiểm tra API nếu cần:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/health
```

Nếu copy CSDL cũ từ máy cá nhân, tài khoản/mật khẩu vẫn là dữ liệu cũ; biến môi trường không đặt lại mật khẩu đã có. Đổi mật khẩu qua UI trước khi chia sẻ link.

**Vị trí dữ liệu và log:**

```text
D:\BTLXuLyAnh\data\app.db
D:\BTLXuLyAnh\data\secret.key
D:\BTLXuLyAnh\data\uploads\
D:\BTLXuLyAnh\data\logs\server_*.log
```

Có thể tách dữ liệu khỏi mã nguồn bằng `-DataDir D:\OMRData`; khi đó dùng cùng tham số cho mọi lần start và install-task. Script start chủ động dùng SQLite tại DataDir và bỏ `OMR_DATABASE_URL` kế thừa trong tiến trình để tránh kết nối nhầm DB khác.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\deploy\windows\start.ps1 -DataDir D:\OMRData -Port 8000
```

Script giữ một worker, không dùng `--reload`. Giữ nguyên thư mục dữ liệu khi cập nhật mã nguồn. Không cần mở cổng riêng cho DB.

## 4. Cho nhóm truy cập bằng IP

Mặc định start lắng nghe `0.0.0.0:8000`. Sau khi local chạy đúng, mở **PowerShell as Administrator trên VPS**, rồi tạo rule có tên riêng nếu chưa có:

```powershell
if (-not (Get-NetFirewallRule -Name 'OMR-Exam-8000' -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -Name 'OMR-Exam-8000' -DisplayName 'OMR Exam TCP 8000' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8000
}
```

Nếu nhà cung cấp VPS còn có firewall/security group, mở TCP 8000 ở bảng quản trị của họ. Đây là bước riêng với Windows Firewall. Không thay các rule đang phục vụ website khác. [Tham chiếu New-NetFirewallRule](https://learn.microsoft.com/en-us/powershell/module/netsecurity/new-netfirewallrule)

Từ máy khác, mở `http://65.108.75.245:8000` khi chạy backend trên `0.0.0.0` và đã mở TCP 8000. Nếu local health OK nhưng máy khác không vào được, kiểm tra IP public, rule Windows, firewall của nhà cung cấp và cổng đang nghe. Khi cấu hình HTTPS proxy với backend loopback ở mục 6, dùng tên miền thay cho truy cập trực tiếp cổng 8000.

Tạo tài khoản giáo viên riêng cho người test. HTTP qua IP phù hợp để thử upload trên dữ liệu demo; camera trong trình duyệt cần localhost hoặc HTTPS. Dùng mục 6 nếu muốn test webcam qua Internet.

## 5. Chạy nền sau khi ngắt Remote Desktop và sau reboot

Sau khi đăng nhập và smoke test thành công, nhấn **Ctrl+C** ở terminal server để dừng bản foreground. Mở PowerShell as Administrator bằng **cùng tài khoản Windows** đã cài ứng dụng, chạy:

```powershell
cd D:\BTLXuLyAnh
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\deploy\windows\install-task.ps1
```

Nếu khởi tạo bằng thư mục/cổng riêng, truyền lại đúng giá trị:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\deploy\windows\install-task.ps1 -DataDir D:\OMRData -Port 8000
```

Script tạo task `OMR-Exam` chạy khi máy khởi động và yêu cầu chạy ngay. Task dùng tài khoản Windows hiện tại với S4U, chạy không phụ thuộc phiên RDP và không lưu mật khẩu Windows. Task dùng quyền Limited; tài khoản phải có quyền đọc mã nguồn và ghi DataDir. S4U không phù hợp với dữ liệu trên network share hoặc file mã hóa EFS. Nếu chính sách máy/domain không cho S4U hoặc log on as batch job, cấu hình tài khoản chạy task trong Task Scheduler theo chính sách của VPS; không bỏ qua lỗi rồi coi ứng dụng đã chạy. [Principal của Scheduled Tasks](https://learn.microsoft.com/en-us/powershell/module/scheduledtasks/new-scheduledtaskprincipal)

Kiểm tra task và ứng dụng:

```powershell
Get-ScheduledTask -TaskName OMR-Exam
Get-ScheduledTaskInfo -TaskName OMR-Exam
Invoke-RestMethod http://127.0.0.1:8000/api/health
Get-ChildItem .\data\logs -Filter 'server_*.log' | Sort-Object LastWriteTime -Descending | Select-Object -First 3
```

Nếu DataDir là `D:\OMRData`, xem log trong `D:\OMRData\logs`. Task ở trạng thái Running chưa đủ: cần health OK, đăng nhập được và kiểm tra một lần sau khi ngắt RDP. Kiểm tra lại sau reboot khi tiện để xác nhận trigger.

Quản lý:

```powershell
Stop-ScheduledTask -TaskName OMR-Exam
Start-ScheduledTask -TaskName OMR-Exam
```

Không chạy thêm `python run.py` cùng cổng khi task đang chạy. Script không ghi đè task đã tồn tại; nếu cần đổi cổng/DataDir, dừng và xem cấu hình task `OMR-Exam` trước khi sửa hoặc đăng ký lại, không thay task của ứng dụng khác.

## 6. Có tên miền: HTTPS với Caddy

Cấu hình đã chuẩn bị cho tên miền **vdtcall.site** tại [deploy/windows/Caddyfile](../deploy/windows/Caddyfile):

```caddyfile
vdtcall.site {
    reverse_proxy 127.0.0.1:8000
}
```

Trong trang quản lý DNS, cấu hình bản ghi như sau:

| Loại | Tên / Host | Giá trị |
|---|---|---|
| A | `@` (tên miền gốc `vdtcall.site`) | `65.108.75.245` |

Sửa bản ghi A đang trỏ `216.198.79.1` thành `65.108.75.245`, không giữ đồng thời hai IP này cho cùng hostname nếu chỉ muốn ứng dụng chạy ở VPS mới. Kiểm tra lại sau khi DNS cập nhật bằng `Resolve-DnsName vdtcall.site -Type A`. Nếu có bản ghi AAAA, kiểm tra nó cũng trỏ tới IPv6 hoạt động của chính VPS. Nếu dùng DNS qua proxy/CDN, địa chỉ được phân giải có thể là IP của proxy; cần kiểm tra cả cấu hình origin trong bảng quản trị DNS. Có tên miền chưa đồng nghĩa đã trỏ DNS đúng; cần đối chiếu IP VPS trước khi chạy cấp chứng chỉ.

Đường truy cập sau khi hoàn tất là `https://vdtcall.site`, không cần thêm `:8000`. Chỉ tên miền gốc được cấu hình ở đây; nếu muốn thêm `www` hoặc tên miền phụ, cần thêm cả DNS và hostname tương ứng trong Caddyfile.

Nếu VPS đã có IIS/Nginx/Caddy chiếm cổng 80/443, thêm reverse proxy cho hostname `vdtcall.site` vào hệ thống đang dùng. Không chạy thêm proxy tranh cùng cổng.

Nếu chưa có proxy, cài [Caddy bản Windows](https://caddyserver.com/docs/install), trỏ bản ghi A của `vdtcall.site` về `65.108.75.245`, và mở TCP 80/443 ở cả Windows Firewall lẫn nhà cung cấp. Nếu có bản ghi AAAA, nó cũng phải trỏ đúng IPv6 hoạt động của VPS.

Trên VPS, chạy PowerShell as Administrator để kiểm tra cổng 80/443:

```powershell
Get-NetTCPConnection -State Listen -LocalPort 80,443 -ErrorAction SilentlyContinue
```

Nếu cổng đang được sử dụng, xác định dịch vụ đang chạy và dùng proxy hiện có. Khi cổng dành cho Caddy, thêm rule riêng cho HTTP/HTTPS nếu chưa có:

```powershell
if (-not (Get-NetFirewallRule -Name 'OMR-Exam-HTTPS' -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -Name 'OMR-Exam-HTTPS' -DisplayName 'OMR Exam HTTP HTTPS' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 80,443
}
```

Nếu nhà cung cấp có firewall riêng, mở thêm TCP 80/443 ở đó. Caddy vẫn proxy tới `127.0.0.1:8000` trên chính VPS; không thay upstream này thành IP public.

Chạy backend chỉ trên loopback khi đi qua proxy:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\deploy\windows\start.ps1 -BindAddress 127.0.0.1
```

Với task, truyền `-BindAddress 127.0.0.1` lúc đăng ký. Nếu task đã tồn tại, dừng và sửa cấu hình task hiện có trước; script không tự thay.

Với `vdtcall.site`, dùng luôn file `deploy/windows/Caddyfile` đã chuẩn bị. Với tên miền khác, copy `deploy/windows/Caddyfile.example` thành `Caddyfile` rồi thay hostname. Sau khi đã cài Caddy vào PATH, chạy từ thư mục gốc dự án:

```powershell
caddy validate --config .\deploy\windows\Caddyfile --adapter caddyfile
caddy run --config .\deploy\windows\Caddyfile --adapter caddyfile
```

`caddy run` là lệnh foreground; nếu dùng lâu dài, cấu hình Caddy như Windows service theo tài liệu cài đặt, để proxy cũng sống sau khi ngắt RDP/reboot. Sau khi HTTPS hoạt động, chia sẻ `https://vdtcall.site` cho nhóm; người dùng cấp quyền camera trên trình duyệt của họ.

Caddy quản lý chứng chỉ và chuyển tiếp về `127.0.0.1:8000` khi DNS/cổng được thiết lập đúng. Uvicorn được cấu hình chỉ tin proxy headers từ `127.0.0.1`. [Reverse proxy](https://caddyserver.com/docs/quick-starts/reverse-proxy), [Automatic HTTPS](https://caddyserver.com/docs/automatic-https), [Uvicorn settings](https://uvicorn.dev/settings/)

Nếu chỉ dùng HTTPS proxy, có thể bỏ rule TCP 8000 đã tạo ở mục 4; giữ backend loopback. Rule cần xử lý là `OMR-Exam-8000`, không đụng các rule khác.

## 7. Cập nhật và sao lưu

1. Dừng task `OMR-Exam` và xác nhận backend không còn ghi dữ liệu.
2. Sao lưu **toàn bộ DataDir**, gồm DB, file WAL/SHM nếu còn, ảnh và `secret.key`, sang thư mục sao lưu riêng có ngày giờ. Không chỉ copy `app.db` trong lúc server đang ghi.
3. Cập nhật mã nguồn; giữ nguyên DataDir, không xóa thư mục dự án để chép đè bản mới.
4. Chạy lại `prepare.ps1`, sau đó `Start-ScheduledTask -TaskName OMR-Exam`.
5. Kiểm tra health, đăng nhập, bài cũ, ảnh cũ, PDF và chấm một bài mới.

Nếu cần chuyển từ dữ liệu máy cá nhân sang VPS, dừng ứng dụng nguồn trước khi copy toàn bộ dữ liệu; giữ nguyên các đường dẫn tương đối trong uploads. Nếu chỉ muốn đợt test mới, để VPS tạo DataDir mới thay vì copy DB cũ.

## 8. Trạng thái kiểm chứng

Đã đối chiếu script với cấu hình hiện tại: `OMR_DATA_DIR`, SQLite, `frontend/dist`, API health và font PDF. Kiểm tra cú pháp PowerShell được thực hiện trong workspace; chưa cài thư viện, đăng ký task, mở firewall hoặc chạy ứng dụng trên VPS đích. Chỉ coi triển khai thành công sau khi health, đăng nhập và chấm thử hoạt động từ thiết bị bên ngoài.
