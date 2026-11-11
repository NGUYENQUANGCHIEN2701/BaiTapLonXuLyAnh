# Chatbot Trợ lý AI trong OMR Exam

Chatbot kết nối QtedEdu Education, chạy model `ToanPhamAIEngi/Qwen3-8B-Vietnam-MultiDomainEdu`
trên Kaggle qua ngrok. Model và system prompt được cấu hình tại server AI.

Chatbot xuất hiện ở góc dưới bên phải sau khi đăng nhập, dùng được cho admin và giáo viên.
Trên điện thoại, khung chat mở gần toàn màn hình và điều chỉnh theo vùng hiển thị khi bật bàn phím.
Giao diện có câu hỏi gợi ý, Markdown/bảng/đoạn mã, sao chép câu trả lời, thử lại, sửa câu hỏi lỗi,
trạng thái kết nối và hội thoại mới. Enter gửi, Shift + Enter xuống dòng, Escape đóng khung.

## Chạy

```powershell
pip install -r requirements.txt
cd frontend
npm ci
npm run build
cd ..
python run.py
```

Nên dùng Node.js 20+ khi build, phù hợp yêu cầu của React Router trong dự án.
Backend đã dùng `httpx` trong `requirements.txt`, không cần OpenAI SDK.
Sau khi cập nhật mã/build, khởi động lại tiến trình FastAPI đang chạy để đăng ký API chatbot.

## Cấu hình backend

| Biến môi trường | Mặc định | Ý nghĩa |
|---|---|---|
| `OMR_CHAT_COMPLETIONS_URL` | `https://sly-series-landowner.ngrok-free.dev/v1/chat/completions` | URL sinh câu trả lời đầy đủ |
| `OMR_CHAT_HEALTH_URL` | `https://sly-series-landowner.ngrok-free.dev/health` | URL kiểm tra dịch vụ |
| `OMR_CHAT_API_KEY` | Rỗng | Khóa Bearer nếu dịch vụ yêu cầu |
| `OMR_CHAT_TIMEOUT` | `90` | Timeout HTTP sinh câu trả lời, giây |
| `OMR_CHAT_HEALTH_TIMEOUT` | `5` | Timeout kiểm tra health, giây |
| `OMR_CHAT_MAX_TOKENS` | `2048` | Giới hạn token đầu ra |
| `OMR_CHAT_MAX_CONCURRENT` | `2` | Số yêu cầu sinh câu trả lời đồng thời mỗi worker |

Ví dụ thay endpoint khi đường hầm ngrok đổi địa chỉ:

```powershell
$env:OMR_CHAT_COMPLETIONS_URL = 'https://your-tunnel.ngrok-free.dev/v1/chat/completions'
$env:OMR_CHAT_HEALTH_URL = 'https://your-tunnel.ngrok-free.dev/health'
# Chỉ đặt OMR_CHAT_API_KEY nếu dịch vụ của bạn yêu cầu.
python run.py
```

Các biến phải có trong môi trường của tiến trình khởi chạy backend; thay đổi cần khởi động lại backend.
`app/config.py` đọc biến môi trường của tiến trình, không tự tải file `.env`.
Nếu chạy qua Windows Task Scheduler, cấu hình biến cho tài khoản/tác vụ chạy hệ thống rồi khởi động lại tác vụ.
Không đặt API key trong biến `VITE_*` hoặc mã frontend.

## API nội bộ và contract upstream

Cả hai API nội bộ yêu cầu cookie đăng nhập `omr_session`:

- `GET /api/chat/health`: trả `{ "available": true|false, "message": "..." }`.
  Kết quả health được cache 30 giây; health lỗi không chặn việc gửi câu hỏi.
  HTTP 200 từ upstream cần có JSON object không rỗng. Các cờ `ok: false`, `healthy: false`
  và status `error/offline/unhealthy/down` được coi là chưa sẵn sàng.
- `POST /api/chat/completions`: nhận `{ "messages": [{ "role": "user", "content": "..." }] }`.
  Lịch sử bắt đầu bằng user, xen kẽ user/assistant, kết thúc bằng user.
  Trả `{ "content": "...", "truncated": false }`.

Backend gọi `POST` tới QtedEdu với `Content-Type: application/json` theo đúng contract:

```json
{
  "messages": [{"role": "user", "content": "Giải thích định luật II Newton"}],
  "temperature": 0.3,
  "max_tokens": 2048
}
```

`messages` chứa lịch sử user/assistant đã được kiểm tra. Backend không thêm system prompt,
không gửi `model` hoặc `stream`; model do server Kaggle chọn. Biến `OMR_CHAT_MODEL` cũ không còn sử dụng.
Upstream trả `{"response": "Nội dung trả lời của AI"}`. Backend đọc chuỗi `response`, kiểm tra
nội dung và chuyển thành `{"content": "...", "truncated": false}` cho giao diện hiện tại.
API QtedEdu không cung cấp trạng thái cắt ngắn, nên backend không suy đoán `finish_reason`.
Các khối `<think>...</think>` được loại khỏi nội dung hiển thị; nội dung suy luận chưa đóng
được coi là phản hồi không hợp lệ. Backend gửi header `ngrok-skip-browser-warning: true` khi gọi dịch vụ.

## Lịch sử và giới hạn

- Hội thoại chỉ lưu trong `sessionStorage` của tab, theo ID tài khoản. Không lưu vào database.
- Đóng khung hoặc tải lại trang vẫn giữ hội thoại trong cùng tab. Đăng xuất, hết phiên hoặc
  bắt đầu hội thoại mới sẽ xóa nội dung tương ứng; đăng nhập mới xóa lịch sử cũ của tab.
- UI lưu tối đa khoảng 60 tin nhắn gần nhất, cắt theo cặp hỏi/đáp.
- Mỗi câu hỏi tối đa 4.000 ký tự; mỗi câu trả lời tối đa 16.000 ký tự.
- Mỗi request tối đa 20 tin nhắn, 20.000 ký tự tổng cộng. UI chọn tối đa 19 tin nhắn gần nhất
  và tự bỏ cặp cũ để giữ trong giới hạn.
- Mỗi tài khoản tối đa một yêu cầu đang xử lý trong mỗi worker; toàn worker mặc định hai yêu cầu.
  Triển khai nhiều worker cần bộ giới hạn dùng chung nếu muốn giới hạn trên toàn dịch vụ.
- Frontend chấm dứt chờ sau 120 giây. Khi đóng chat, request vẫn tiếp tục để giữ câu trả lời;
  khi rời phiên đăng nhập hoặc tạo hội thoại mới, frontend hủy request của cuộc chat cũ.
- Kết quả AI được render bằng `react-markdown` và `remark-gfm`: tiêu đề, danh sách, bảng,
  trích dẫn và đoạn mã. `remark-math` + `rehype-katex` hiển thị công thức `$F = ma$` trong dòng
  và `$$...$$` dạng khối; CSS/font KaTeX được build cùng frontend, không tải từ CDN.
  Bảng, đoạn mã và công thức dài cuộn ngang trong khung chat trên điện thoại.
  HTML và ảnh từ model bị bỏ, URL nguy hiểm được lọc; liên kết mở tab mới với
  `noopener noreferrer`. KaTeX dùng `trust: false`.

Model nhận nội dung câu hỏi/lịch sử do người dùng gửi; system prompt do server QtedEdu quản lý.
Chatbot chưa đọc database, điểm, danh sách thí sinh hoặc ảnh; chưa thực hiện thao tác quản trị/chấm bài.

## Lỗi và chẩn đoán

| Mã API chat | Trường hợp |
|---|---|
| 401 | Phiên đăng nhập hệ thống thiếu hoặc hết hạn |
| 422 | Tin nhắn/lịch sử không đúng contract hoặc quá giới hạn |
| 429 | Tài khoản đang có request, worker hết lượt hoặc upstream quá tải |
| 502 | Upstream báo lỗi, thiếu quyền truy cập hoặc phản hồi sai định dạng |
| 503 | Không kết nối được upstream |
| 504 | Upstream hết thời gian chờ |

Lỗi 401/403 từ upstream được đổi thành 502, tránh làm người dùng đăng xuất khỏi OMR Exam.
Backend không chuyển nội dung lỗi thô/khóa truy cập upstream ra UI.

Nếu ngrok trả `ERR_NGROK_3200`, khởi động lại server model và đường hầm ngrok,
kiểm tra URL `/health`, rồi cập nhật biến URL nếu địa chỉ đã đổi. UI vẫn cho thử gửi khi health lỗi.
Health thành công chỉ xác nhận endpoint health; cần gửi một câu hỏi để xác minh model và API key.

Nếu API trả `{"response": "..."}` nhưng backend báo «nội dung không hợp lệ», kiểm tra đã chạy
mã mới và khởi động lại FastAPI. Bản cũ đọc `choices[0].message.content` nên không tương thích QtedEdu.

## Kiểm thử

```powershell
python -m pytest tests -q
cd frontend
npm run build
npx playwright install chromium
npm run test:chat
```

Backend dùng `httpx.MockTransport`, database tạm và kiểm tra cả lỗi xác thực upstream,
timeout, phản hồi sai, cache health, giới hạn đồng thời và giải phóng lượt sau hủy/lỗi.
Playwright chạy Chromium headless trên desktop 1440×1000 và mobile 390×844, mock các API,
kiểm tra gửi nhiều lượt, Markdown an toàn, sao chép, lịch sử, thử lại, đăng xuất/chuyển tài khoản.
Không gọi dịch vụ AI thật trong các bài kiểm thử tự động.

Có thể dùng Chromium cài sẵn bằng biến `PLAYWRIGHT_CHROMIUM_EXECUTABLE` trỏ tới file thực thi
thay cho bước tải browser. Kết quả/ảnh kiểm thử nằm trong `frontend/test-results/` (được git bỏ qua).
