import { useQuery } from "@tanstack/react-query";
import { Check, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ExamFormModal } from "../components/ExamForm";
import { Button, Card, Empty, Input, PageHeader, PageLoader } from "../components/ui";
import { api } from "../lib/api";
import type { Exam } from "../lib/types";
import { cn, fmtScore, scoreColor } from "../lib/utils";

function Step({ done, label }: { done: boolean; label: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1", done ? "text-slate-700" : "text-slate-400")}>
      {done ? <Check className="h-3.5 w-3.5 text-[#1e6b3a]" /> : <span className="inline-block h-3.5 w-3.5 rounded-full border border-dashed border-slate-300" />}
      {label}
    </span>
  );
}

export default function Exams() {
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["exams"], queryFn: () => api.get<Exam[]>("/api/exams") });
  const open = params.get("new") === "1";
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data ?? []).filter((e) => !s || e.name.toLowerCase().includes(s) || e.subject.toLowerCase().includes(s));
  }, [data, q]);

  return (
    <div>
      <PageHeader
        title="Kỳ thi"
        subtitle="Mỗi kỳ thi có bộ phiếu, đáp án theo mã đề, danh sách thí sinh và kết quả riêng."
        actions={<Button icon={<Plus />} onClick={() => setParams({ new: "1" })}>Tạo kỳ thi</Button>}
      />
      {isLoading ? (
        <PageLoader />
      ) : !data?.length ? (
        <Card>
          <Empty title="Chưa có kỳ thi" description="Bắt đầu bằng việc tạo một kỳ thi mới."
            action={<Button icon={<Plus />} onClick={() => setParams({ new: "1" })}>Tạo kỳ thi</Button>} />
        </Card>
      ) : (
        <>
          <div className="relative mb-4 max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" placeholder="Tìm theo tên hoặc môn" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-[12px] text-slate-500">
                  <tr className="border-b border-slate-200">
                    <th className="px-5 py-2.5 font-normal">Kỳ thi</th>
                    <th className="px-4 py-2.5 font-normal">Ngày thi</th>
                    <th className="px-4 py-2.5 text-right font-normal">Số câu</th>
                    <th className="px-4 py-2.5 font-normal">Chuẩn bị</th>
                    <th className="px-4 py-2.5 text-right font-normal">Bài làm</th>
                    <th className="px-4 py-2.5 text-right font-normal">Cần xem</th>
                    <th className="px-5 py-2.5 text-right font-normal">Điểm TB</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((e) => (
                    <tr key={e.id} className="group cursor-pointer hover:bg-slate-50" onClick={() => nav(`/exams/${e.id}`)}>
                      <td className="px-5 py-3">
                        <Link to={`/exams/${e.id}`} className="font-medium text-slate-900 group-hover:underline" onClick={(ev) => ev.stopPropagation()}>
                          {e.name}
                        </Link>
                        <div className="text-[12.5px] text-slate-500">
                          {e.subject || "—"}
                          {e.owner_name && <span className="text-slate-400"> · {e.owner_name}</span>}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{e.exam_date ? new Date(e.exam_date).toLocaleDateString("vi-VN") : "—"}</td>
                      <td className="px-4 py-3 text-right tabular text-slate-600">{e.num_questions}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[12.5px]">
                          <Step done={e.num_keys > 0} label={e.num_keys ? `${e.num_keys} mã đề` : "Đáp án"} />
                          <Step done={e.num_students > 0} label={e.num_students ? `${e.num_students} thí sinh` : "Thí sinh"} />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular">{e.num_submissions || <span className="text-slate-400">0</span>}</td>
                      <td className="px-4 py-3 text-right tabular">
                        {e.num_review ? <span className="font-semibold text-[#9a6400]">{e.num_review}</span> : <span className="text-slate-400">—</span>}
                      </td>
                      <td className={cn("px-5 py-3 text-right font-display text-[18px] tabular", scoreColor(e.avg_score, e.max_score))}>{fmtScore(e.avg_score, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
      <ExamFormModal open={open} onClose={() => setParams({})} onSaved={(e) => nav(`/exams/${e.id}`)} />
    </div>
  );
}
