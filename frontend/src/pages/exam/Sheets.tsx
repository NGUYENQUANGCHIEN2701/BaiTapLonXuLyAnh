import { Camera, FileText, Printer, UserSquare2 } from "lucide-react";
import { useState } from "react";
import { Button, Card, CardHeader, Field, Input, Spinner } from "../../components/ui";
import { useExam } from "./ExamLayout";

export default function Sheets() {
  const exam = useExam();
  const [copies, setCopies] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const open = (url: string) => window.open(url, "_blank", "noopener");

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card className="overflow-hidden">
        <CardHeader title="Xem trước phiếu trả lời" subtitle={`Khổ A4 · ${exam.num_questions} câu · mã QR chứa mã kỳ thi #${exam.id}`} />
        <div className="relative flex justify-center bg-slate-100 p-6">
          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Spinner />
            </div>
          )}
          <img
            src={`/api/exams/${exam.id}/sheet.png?v=${exam.num_questions}-${exam.num_options}-${encodeURIComponent(exam.name)}`}
            onLoad={() => setLoaded(true)}
            alt="Phiếu trả lời"
            className="w-full max-w-[640px] rounded shadow-sm ring-1 ring-slate-200"
          />
        </div>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader title="Tải phiếu" />
          <div className="space-y-5 p-5">
            <div>
              <div className="mb-2 flex items-center gap-2 font-medium text-slate-800">
                <FileText className="h-4 w-4 text-slate-500" /> Phiếu trắng
              </div>
              <div className="flex items-end gap-2">
                <Field label="Số bản" className="w-24">
                  <Input type="number" min={1} max={500} value={copies} onChange={(e) => setCopies(Math.max(1, Math.min(500, Number(e.target.value) || 1)))} />
                </Field>
                <Button className="flex-1" icon={<Printer className="h-4 w-4" />} onClick={() => open(`/api/exams/${exam.id}/sheet.pdf?copies=${copies}`)}>
                  Mở PDF để in
                </Button>
              </div>
            </div>
            <div className="border-t border-border pt-5">
              <div className="mb-1 flex items-center gap-2 font-medium text-slate-800">
                <UserSquare2 className="h-4 w-4 text-slate-500" /> Phiếu cá nhân hóa
              </div>
              <p className="mb-3 text-[15px] text-slate-500">
                Mỗi thí sinh một trang, in sẵn họ tên, lớp, phòng và <b>tô sẵn SBD</b> — loại bỏ lỗi tô sai số báo danh.
              </p>
              <Button variant="secondary" className="w-full" disabled={!exam.num_students} onClick={() => open(`/api/exams/${exam.id}/sheet.pdf?personalized=true`)}>
                {exam.num_students ? `In ${exam.num_students} phiếu cá nhân` : "Cần có danh sách thí sinh"}
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2 font-medium text-slate-800">
            Lưu ý khi in và chụp
          </div>
          <ul className="space-y-2 text-[15px] text-slate-600">
            <li>• In đúng tỉ lệ 100% (tắt “Fit to page”), giấy trắng, mực đen.</li>
            <li>• Không làm bẩn / che 4 ô vuông đen ở góc phiếu — đó là marker để định vị.</li>
            <li>• Ô vuông góc trên-trái có lỗ trắng: giúp hệ thống tự nhận chiều phiếu khi ảnh bị xoay.</li>
            <li className="flex gap-1">
              <Camera className="mt-0.5 h-4 w-4 shrink-0" /> Chụp đủ 4 góc, đủ sáng, tránh bóng đổ đậm. Góc nghiêng tới ~30° vẫn chấm được.
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
