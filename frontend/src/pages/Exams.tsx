import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarDays, ClipboardList, FileCheck2, KeyRound, Plus, Search, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ExamFormModal } from "../components/ExamForm";
import { Badge, Button, Card, Empty, Input, PageHeader, PageLoader } from "../components/ui";
import { api } from "../lib/api";
import type { Exam } from "../lib/types";
import { fmtScore, scoreColor } from "../lib/utils";

function ExamCard({ e }: { e: Exam }) {
  const steps = [e.num_keys > 0, e.num_students > 0, e.num_submissions > 0];
  const done = steps.filter(Boolean).length;
  return (
    <Link to={`/exams/${e.id}`} className="group">
      <Card className="flex h-full flex-col p-5 transition-all group-hover:-translate-y-0.5 group-hover:shadow-pop group-hover:ring-brand-200">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-slate-900 group-hover:text-brand-700">{e.name}</h3>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500">
              {e.subject || "—"}
              {e.exam_date && (
                <>
                  <span className="text-slate-300">·</span>
                  <CalendarDays className="h-3.5 w-3.5" /> {new Date(e.exam_date).toLocaleDateString("vi-VN")}
                </>
              )}
            </p>
          </div>
          <Badge tone="blue">{e.num_questions} câu</Badge>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg bg-slate-50 py-2">
            <div className="text-lg font-semibold tabular">{e.num_submissions}</div>
            <div className="text-[11px] text-slate-500">Bài làm</div>
          </div>
          <div className="rounded-lg bg-slate-50 py-2">
            <div className="text-lg font-semibold tabular">{e.num_students}</div>
            <div className="text-[11px] text-slate-500">Thí sinh</div>
          </div>
          <div className="rounded-lg bg-slate-50 py-2">
            <div className={`text-lg font-semibold tabular ${scoreColor(e.avg_score, e.max_score)}`}>{fmtScore(e.avg_score, 1)}</div>
            <div className="text-[11px] text-slate-500">Điểm TB</div>
          </div>
        </div>
        <div className="mt-auto pt-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-3">
              <span className={`flex items-center gap-1 ${e.num_keys ? "text-emerald-600" : ""}`}><KeyRound className="h-3.5 w-3.5" /> {e.num_keys} mã đề</span>
              <span className={`flex items-center gap-1 ${e.num_students ? "text-emerald-600" : ""}`}><Users className="h-3.5 w-3.5" /> DS</span>
              <span className={`flex items-center gap-1 ${e.num_submissions ? "text-emerald-600" : ""}`}><FileCheck2 className="h-3.5 w-3.5" /> Chấm</span>
            </span>
            {e.num_review > 0 ? (
              <span className="flex items-center gap-1 font-medium text-amber-700"><AlertTriangle className="h-3.5 w-3.5" /> {e.num_review} cần xem</span>
            ) : (
              <span>{done}/3 bước</span>
            )}
          </div>
          <div className="mt-2 flex gap-1">
            {steps.map((s, i) => (
              <div key={i} className={`h-1 flex-1 rounded-full ${s ? "bg-emerald-500" : "bg-slate-200"}`} />
            ))}
          </div>
        </div>
      </Card>
    </Link>
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
    <div className="animate-fade-in">
      <PageHeader
        title="Kỳ thi"
        subtitle="Quản lý các kỳ thi, đáp án, thí sinh và kết quả chấm."
        actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setParams({ new: "1" })}>Tạo kỳ thi</Button>}
      />
      {isLoading ? (
        <PageLoader />
      ) : !data?.length ? (
        <Card>
          <Empty icon={<ClipboardList className="h-6 w-6" />} title="Chưa có kỳ thi" description="Bắt đầu bằng việc tạo một kỳ thi mới."
            action={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setParams({ new: "1" })}>Tạo kỳ thi</Button>} />
        </Card>
      ) : (
        <>
          <div className="relative mb-4 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" placeholder="Tìm theo tên hoặc môn…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((e) => (
              <ExamCard key={e.id} e={e} />
            ))}
          </div>
        </>
      )}
      <ExamFormModal open={open} onClose={() => setParams({})} onSaved={(e) => nav(`/exams/${e.id}`)} />
    </div>
  );
}
