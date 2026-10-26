import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Circle, Pencil, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ExamFormModal } from "../../components/ExamForm";
import { Button, Card, CardHeader, Field, Input, Modal, StatCard, useConfirm } from "../../components/ui";
import { api, errMsg } from "../../lib/api";
import type { Activity } from "../../lib/types";
import { fmtScore, timeAgo } from "../../lib/utils";
import { ACTION_LABEL } from "../Dashboard";
import { useExam } from "./ExamLayout";

export default function Overview() {
  const exam = useExam();
  const qc = useQueryClient();
  const nav = useNavigate();
  const confirm = useConfirm();
  const [edit, setEdit] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [demoN, setDemoN] = useState(20);
  const { data: activity } = useQuery({
    queryKey: ["activity", exam.id],
    queryFn: () => api.get<Activity[]>(`/api/exams/${exam.id}/activity?limit=15`),
  });

  const demo = useMutation({
    mutationFn: () => api.post<{ created: number }>(`/api/exams/${exam.id}/demo?n=${demoN}`),
    onSuccess: (r) => {
      toast.success(`Đã sinh và chấm ${r.created} phiếu demo`);
      qc.invalidateQueries();
      setDemoOpen(false);
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const steps = [
    { done: true, title: "Tạo kỳ thi", desc: `${exam.num_questions} câu, ${exam.num_options} phương án`, to: "" },
    { done: exam.num_keys > 0, title: "Nhập đáp án", desc: exam.num_keys ? `${exam.num_keys} mã đề` : "Nhập tay, từ Excel hoặc chụp phiếu đáp án", to: "keys" },
    { done: exam.num_students > 0, title: "Danh sách thí sinh", desc: exam.num_students ? `${exam.num_students} thí sinh` : "Không bắt buộc — giúp ghép tên theo SBD", to: "students" },
    { done: exam.num_submissions > 0, title: "In phiếu & chấm bài", desc: exam.num_submissions ? `${exam.num_submissions} bài đã chấm` : "Tải ảnh, PDF quét, hoặc dùng webcam", to: "grade" },
    { done: exam.num_submissions > 0 && exam.num_review === 0, title: "Duyệt bài cần xem lại", desc: exam.num_review ? `${exam.num_review} bài đang chờ` : "Không còn bài nào", to: "results?status=review" },
  ];

  const remove = async () => {
    const ok = await confirm({
      title: "Xóa kỳ thi?",
      message: <>Toàn bộ đáp án, thí sinh, bài làm và ảnh của <b>{exam.name}</b> sẽ bị xóa vĩnh viễn.</>,
      confirmText: "Xóa kỳ thi",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.del(`/api/exams/${exam.id}`);
      qc.invalidateQueries({ queryKey: ["exams"] });
      toast.success("Đã xóa kỳ thi");
      nav("/exams");
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="space-y-6 xl:col-span-2">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Bài đã chấm" value={exam.num_submissions} tone="green" />
          <StatCard label="Cần xem lại" value={exam.num_review} tone="amber" />
          <StatCard label="Điểm trung bình" value={fmtScore(exam.avg_score)} tone="violet" />
        </div>
        <Card>
          <CardHeader title="Quy trình" subtitle="Các bước chuẩn bị và chấm một kỳ thi" />
          <ol className="divide-y divide-slate-100">
            {steps.map((s, i) => (
              <li key={i}>
                <Link to={s.to} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50">
                  {s.done ? <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-500" /> : <Circle className="h-6 w-6 shrink-0 text-slate-300" />}
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-slate-900">
                      {i + 1}. {s.title}
                    </div>
                    <div className="text-sm text-slate-500">{s.desc}</div>
                  </div>
                  <span className="text-sm font-medium text-brand-700">Mở →</span>
                </Link>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader title="Thao tác" />
          <div className="space-y-2 p-4">
            <Button variant="secondary" className="w-full" icon={<Pencil className="h-4 w-4" />} onClick={() => setEdit(true)}>
              Sửa thông tin kỳ thi
            </Button>
            <Button variant="outline" className="w-full" icon={<Sparkles className="h-4 w-4" />} onClick={() => setDemoOpen(true)}>
              Sinh dữ liệu demo
            </Button>
            <Button variant="ghost" className="w-full text-rose-600 hover:bg-rose-50 hover:text-rose-700" icon={<Trash2 className="h-4 w-4" />} onClick={remove}>
              Xóa kỳ thi
            </Button>
          </div>
          {exam.description && <p className="border-t border-slate-100 px-5 py-3 text-sm text-slate-600">{exam.description}</p>}
        </Card>
        <Card>
          <CardHeader title="Lịch sử" />
          <ul className="max-h-[420px] divide-y divide-slate-100 overflow-y-auto">
            {!activity?.length && <li className="px-5 py-6 text-sm text-slate-500">Chưa có hoạt động.</li>}
            {activity?.map((a) => (
              <li key={a.id} className="px-5 py-2.5 text-sm">
                <span className="font-medium text-slate-800">{a.user || "Hệ thống"}</span>{" "}
                <span className="text-slate-600">{ACTION_LABEL[a.action] ?? a.action}</span>
                {a.submission_id && (
                  <Link to={`/submissions/${a.submission_id}`} className="ml-1 text-brand-700 hover:underline">
                    #{a.submission_id}
                  </Link>
                )}
                <div className="text-xs text-slate-400">{timeAgo(a.created_at)}</div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <ExamFormModal open={edit} onClose={() => setEdit(false)} exam={exam} />
      <Modal
        open={demoOpen}
        onClose={() => setDemoOpen(false)}
        title="Sinh dữ liệu demo"
        description="Tạo danh sách thí sinh, đáp án (nếu chưa có) và ảnh chụp mô phỏng phiếu đã tô — rồi chấm tự động. Hữu ích để thử hệ thống hoặc thuyết trình."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDemoOpen(false)}>Hủy</Button>
            <Button loading={demo.isPending} onClick={() => demo.mutate()} icon={<Sparkles className="h-4 w-4" />}>Sinh {demoN} phiếu</Button>
          </>
        }
      >
        <Field label="Số phiếu" hint="Mỗi phiếu mất khoảng 0,3 giây (sinh ảnh + chấm).">
          <Input type="number" min={1} max={100} value={demoN} onChange={(e) => setDemoN(Math.max(1, Math.min(100, Number(e.target.value) || 1)))} />
        </Field>
      </Modal>
    </div>
  );
}
