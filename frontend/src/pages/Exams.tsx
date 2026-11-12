import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownUp,
  BarChart3,
  CalendarDays,
  Check,
  Clock3,
  Eye,
  FileText,
  Layers3,
  ListFilter,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  TriangleAlert,
  UsersRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ExamFormModal } from "../components/ExamForm";
import { Button, Card, Empty, Input, PageLoader, Select, StatusBadge } from "../components/ui";
import { api } from "../lib/api";
import type { Exam } from "../lib/types";
import { cn, fmtScore, scoreColor } from "../lib/utils";

type Period = "all" | "30" | "90" | "year";
type StateFilter = "all" | "graded" | "review" | "setup";

function Step({ done, label }: { done: boolean; label: string }) {
  return <span className={cn("inline-flex items-center gap-1 whitespace-nowrap", done ? "text-slate-700" : "text-text-muted")}>
    {done ? <Check className="h-3.5 w-3.5 text-success" /> : <span className="inline-block h-3.5 w-3.5 rounded-full border border-dashed border-slate-300" />}{label}
  </span>;
}

function SummaryCard({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone: "blue" | "green" | "amber" | "violet" }) {
  const styles = {
    blue: { icon: "bg-primary-soft text-primary", surface: "from-primary-softer to-white", art: "text-primary/15" },
    green: { icon: "bg-success-soft text-success", surface: "from-success-soft/60 to-white", art: "text-success/15" },
    amber: { icon: "bg-warning-soft text-warning", surface: "from-warning-soft/70 to-white", art: "text-warning/20" },
    violet: { icon: "bg-violet-100 text-violet-700", surface: "from-violet-50 to-white", art: "text-violet-600/20" },
  }[tone];
  return <Card className={`relative min-h-[118px] overflow-hidden border-primary-soft bg-gradient-to-br ${styles.surface} p-4 sm:p-5`}>
    <div className="relative z-[1] flex items-center gap-3">
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${styles.icon} [&_svg]:h-6 [&_svg]:w-6`}>{icon}</span>
      <div className="min-w-0"><p className="text-[14px] text-slate-600">{label}</p><p className="mt-1 text-[30px] font-bold leading-none tabular text-navy">{value.toLocaleString("vi-VN")}</p></div>
    </div>
    <span aria-hidden className={`absolute -bottom-2 right-3 [&_svg]:h-[58px] [&_svg]:w-[58px] ${styles.art}`}>{icon}</span>
    <span aria-hidden className="absolute -bottom-7 right-10 h-16 w-28 rounded-[60%] bg-primary-soft/40" />
  </Card>;
}

function ExamHero() {
  return <section className="relative mb-5 grid min-h-[182px] overflow-hidden rounded-2xl bg-primary-softer px-5 py-5 sm:px-7 lg:grid-cols-[1fr_1.12fr] lg:items-center lg:px-8">
    <div className="relative z-[1] flex items-start gap-4">
      <span className="flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary [&_svg]:h-9 [&_svg]:w-9"><CalendarDays /></span>
      <div className="min-w-0 pt-0.5"><h1 className="text-[34px] font-bold leading-tight tracking-tight text-navy sm:text-[42px]">Kỳ thi</h1><p className="mt-1 max-w-[590px] text-[14px] leading-6 text-slate-600 sm:text-[15px]">Quản lý các kỳ thi, bộ phiếu OMR, đáp án và kết quả chấm tự động.</p></div>
    </div>
    <div className="pointer-events-none absolute bottom-0 right-0 top-0 hidden w-[58%] items-center justify-end lg:flex">
      <svg viewBox="0 0 680 200" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <path d="M0 152c110-82 168-64 257-18s182 43 254-8 120-48 169-6v80H0Z" fill="#DBEEFF" />
        <path d="M0 176c115-45 183-22 279-3s203 18 401-52v79H0Z" fill="#C9E5FF" opacity=".75" />
      </svg>
      <svg viewBox="0 0 470 190" className="relative z-[1] mr-2 h-[182px] w-[min(100%,620px)]" aria-hidden="true">
        <path d="M62 55 201 15l108 121-139 35z" fill="#88C6FF" opacity=".42" />
        <g transform="rotate(8 223 94)"><rect x="131" y="8" width="174" height="163" rx="13" fill="white" stroke="#B8D8FA" strokeWidth="3" />
          {[0,1,2,3].map((c)=><text key={c} x={190+c*22} y="35" textAnchor="middle" fontFamily="sans-serif" fontWeight="700" fontSize="13" fill="#365987">{"ABCD"[c]}</text>)}
          {[0,1,2,3].map((r)=><g key={r}><text x="164" y={57+r*25} textAnchor="middle" fontFamily="sans-serif" fontWeight="700" fontSize="12" fill="#31527B">{r+1}</text>{[0,1,2,3].map((c)=><circle key={c} cx={190+c*22} cy={53+r*25} r="8" fill={(r+c)%3===1?"#1686DF":"white"} stroke="#9FC9F5" strokeWidth="2" />)}</g>)}
        </g>
        <path d="M130 8h-18q-10 0-10 10v17m210-27h18q10 0 10 10v17M133 169h-18q-10 0-10-10v-17m217 27h18q10 0 10-10v-17" fill="none" stroke="#0879E2" strokeWidth="4" strokeLinecap="round" />
        <rect x="327" y="48" width="143" height="70" rx="19" fill="#E7F5FF" stroke="#D5EBFF" />
        <circle cx="352" cy="82" r="18" fill="#0879E2" /><path d="m343 82 6 6 12-13" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <text x="379" y="78" fontFamily="sans-serif" fontSize="14" fontWeight="700" fill="#09285D">Chấm OMR tự động</text><text x="379" y="97" fontFamily="sans-serif" fontSize="10" fill="#365987">Nhanh chóng · Chính xác</text>
      </svg>
    </div>
  </section>;
}

export default function Exams() {
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [period, setPeriod] = useState<Period>("all");
  const [subject, setSubject] = useState("all");
  const [stateFilter, setStateFilter] = useState<StateFilter>("all");
  const [sortDescending, setSortDescending] = useState(true);
  const [editing, setEditing] = useState<Exam | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ["exams"], queryFn: () => api.get<Exam[]>("/api/exams") });
  const open = params.get("new") === "1";
  const subjects = useMemo(() => Array.from(new Set((data ?? []).map((exam) => exam.subject).filter(Boolean))).sort((a,b)=>a.localeCompare(b,"vi")), [data]);
  const totals = useMemo(() => (data ?? []).reduce((sum, exam) => ({
    submissions: sum.submissions + exam.num_submissions,
    review: sum.review + exam.num_review,
  }), { submissions: 0, review: 0 }), [data]);
  const filtered = useMemo(() => {
    const search = q.trim().toLocaleLowerCase("vi");
    const now = new Date();
    const cutoff = period === "30" ? new Date(now.getFullYear(), now.getMonth(), now.getDate()-30) : period === "90" ? new Date(now.getFullYear(), now.getMonth(), now.getDate()-90) : period === "year" ? new Date(now.getFullYear(), 0, 1) : null;
    return (data ?? []).filter((exam) => {
      const matchesSearch = !search || `${exam.name} ${exam.subject} ${exam.owner_name}`.toLocaleLowerCase("vi").includes(search);
      const examDate = exam.exam_date ? new Date(`${exam.exam_date}T00:00:00`) : null;
      const matchesPeriod = !cutoff || (!!examDate && examDate >= cutoff && examDate <= now);
      const matchesSubject = subject === "all" || exam.subject === subject;
      const matchesState = stateFilter === "all" || (stateFilter === "graded" && exam.num_submissions > 0) || (stateFilter === "review" && exam.num_review > 0) || (stateFilter === "setup" && (!exam.num_keys || !exam.num_students));
      return matchesSearch && matchesPeriod && matchesSubject && matchesState;
    }).sort((a,b)=>{
      const diff=(a.exam_date||"").localeCompare(b.exam_date||"") || b.id-a.id;
      return sortDescending ? -diff : diff;
    });
  }, [data,q,period,subject,stateFilter,sortDescending]);

  return <div className="exam-list-page">
    <ExamHero />
    {isLoading ? <PageLoader /> : <>
      <section aria-label="Thống kê kỳ thi" className="mb-5 grid grid-cols-1 gap-3 min-[470px]:grid-cols-2 2xl:grid-cols-4">
        <SummaryCard label="Tổng kỳ thi" value={data?.length ?? 0} icon={<CalendarDays />} tone="blue" />
        <SummaryCard label="Tổng bài làm" value={totals.submissions} icon={<Layers3 />} tone="violet" />
        <SummaryCard label="Đã chấm" value={Math.max(0,totals.submissions-totals.review)} icon={<UsersRound />} tone="green" />
        <SummaryCard label="Cần xem lại" value={totals.review} icon={<Clock3 />} tone="amber" />
      </section>

      <section aria-label="Tìm và lọc kỳ thi" className="mb-5 grid grid-cols-1 gap-3 rounded-xl border border-border bg-white p-3 sm:p-4 md:grid-cols-2 xl:grid-cols-[minmax(250px,1.7fr)_repeat(3,minmax(150px,1fr))_auto]">
        <label className="relative block min-w-0 xl:col-span-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
          <Input aria-label="Tìm kỳ thi theo tên hoặc môn học" className="h-12 rounded-xl pl-11" placeholder="Tìm theo tên kỳ thi hoặc môn học..." value={q} onChange={(e)=>setQ(e.target.value)} />
        </label>
        <label className="relative block min-w-0"><CalendarDays className="pointer-events-none absolute left-3.5 top-1/2 z-[1] h-[18px] w-[18px] -translate-y-1/2 text-slate-500" /><Select aria-label="Lọc theo thời gian" className="h-12 rounded-xl pl-11" value={period} onChange={(e)=>setPeriod(e.target.value as Period)}><option value="all">Tất cả thời gian</option><option value="30">30 ngày gần đây</option><option value="90">90 ngày gần đây</option><option value="year">Năm nay</option></Select></label>
        <label className="relative block min-w-0"><Layers3 className="pointer-events-none absolute left-3.5 top-1/2 z-[1] h-[18px] w-[18px] -translate-y-1/2 text-slate-500" /><Select aria-label="Lọc theo môn học" className="h-12 rounded-xl pl-11" value={subject} onChange={(e)=>setSubject(e.target.value)}><option value="all">Tất cả môn</option>{subjects.map((item)=><option key={item} value={item}>{item}</option>)}</Select></label>
        <label className="relative block min-w-0"><SlidersHorizontal className="pointer-events-none absolute left-3.5 top-1/2 z-[1] h-[18px] w-[18px] -translate-y-1/2 text-slate-500" /><Select aria-label="Lọc theo trạng thái" className="h-12 rounded-xl pl-11" value={stateFilter} onChange={(e)=>setStateFilter(e.target.value as StateFilter)}><option value="all">Tất cả trạng thái</option><option value="graded">Đã có bài làm</option><option value="review">Cần xem lại</option><option value="setup">Thiếu chuẩn bị</option></Select></label>
        <Button icon={<Plus />} className="h-12 w-full whitespace-nowrap xl:w-auto" onClick={()=>setParams({new:"1"})}>Tạo kỳ thi</Button>
      </section>

      {!data?.length ? <Card><Empty title="Chưa có kỳ thi" description="Bắt đầu bằng việc tạo một kỳ thi mới." action={<Button icon={<Plus />} onClick={()=>setParams({new:"1"})}>Tạo kỳ thi</Button>} /></Card> : !filtered.length ? <Card><Empty icon={<ListFilter />} title="Không tìm thấy kỳ thi" description="Thử đổi từ khóa hoặc bộ lọc để xem thêm kỳ thi." action={<Button variant="secondary" onClick={()=>{setQ("");setPeriod("all");setSubject("all");setStateFilter("all");}}>Xóa bộ lọc</Button>} /></Card> : <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1140px] text-[14px]">
            <thead className="text-left text-[13px]"><tr className="border-b border-border">
              <th className="px-5 py-3 font-semibold">Kỳ thi</th>
              <th className="px-4 py-3 font-semibold"><button className="inline-flex items-center gap-1.5" onClick={()=>setSortDescending((v)=>!v)}>Ngày thi <ArrowDownUp className="h-3.5 w-3.5 text-slate-500" /></button></th>
              <th className="px-4 py-3 text-right font-semibold">Số câu</th><th className="px-4 py-3 font-semibold">Chuẩn bị</th><th className="px-4 py-3 text-right font-semibold">Bài làm</th><th className="px-4 py-3 font-semibold">Trạng thái</th><th className="px-4 py-3 text-right font-semibold">Điểm TB</th><th className="px-5 py-3 text-right font-semibold">Thao tác</th>
            </tr></thead>
            <tbody className="divide-y divide-border">{filtered.map((exam)=>{
              const ready=exam.num_submissions>0;
              return <tr key={exam.id} onClick={()=>nav(`/exams/${exam.id}`)} className="group cursor-pointer hover:bg-primary-softer">
                <td className="px-5 py-3.5"><div className="flex items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"><FileText className="h-5 w-5" /></span><div className="min-w-0"><Link to={`/exams/${exam.id}`} onClick={(event)=>event.stopPropagation()} className="block max-w-[260px] truncate text-[15px] font-semibold text-navy hover:text-primary-hover hover:underline">{exam.name}</Link><p className="mt-0.5 max-w-[260px] truncate text-[13px] text-slate-600">{exam.subject || "Chưa chọn môn"}{exam.owner_name&&` · ${exam.owner_name}`}</p></div></div></td>
                <td className="whitespace-nowrap px-4 py-3.5 text-slate-700"><span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4 text-slate-500" />{exam.exam_date ? new Date(`${exam.exam_date}T00:00:00`).toLocaleDateString("vi-VN") : "—"}</span></td>
                <td className="px-4 py-3.5 text-right tabular text-slate-700">{exam.num_questions}</td>
                <td className="px-4 py-3.5"><div className="flex flex-col gap-1 text-[13px]"><Step done={exam.num_keys>0} label={exam.num_keys?`${exam.num_keys} mã đề`:"Đáp án"} /><Step done={exam.num_students>0} label={exam.num_students?`${exam.num_students} thí sinh`:"Thí sinh"} /></div></td>
                <td className="px-4 py-3.5 text-right tabular font-medium text-slate-800">{exam.num_submissions}</td>
                <td className="px-4 py-3.5">{ready?<StatusBadge status="graded" />:<span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-[13px] font-medium text-slate-600"><TriangleAlert className="h-3.5 w-3.5" />Chưa có bài làm</span>}</td>
                <td className={cn("whitespace-nowrap px-4 py-3.5 text-right font-sans text-[18px] font-bold tabular",scoreColor(exam.avg_score,exam.max_score))}>{fmtScore(exam.avg_score,1)}</td>
                <td className="px-5 py-3.5"><div className="flex justify-end gap-1.5">
                  <Link to={`/exams/${exam.id}`} onClick={(event)=>event.stopPropagation()} aria-label={`Xem kỳ thi ${exam.name}`} title="Xem kỳ thi" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-white text-slate-600 hover:border-primary hover:bg-primary-softer hover:text-primary-hover"><Eye className="h-[18px] w-[18px]" /></Link>
                  <Link to={`/exams/${exam.id}/stats`} onClick={(event)=>event.stopPropagation()} aria-label={`Thống kê kỳ thi ${exam.name}`} title="Thống kê" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-white text-slate-600 hover:border-primary hover:bg-primary-softer hover:text-primary-hover"><BarChart3 className="h-[18px] w-[18px]" /></Link>
                  <button aria-label={`Sửa kỳ thi ${exam.name}`} title="Sửa kỳ thi" onClick={(event)=>{event.stopPropagation();setEditing(exam);}} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-white text-slate-600 hover:border-primary hover:bg-primary-softer hover:text-primary-hover"><Pencil className="h-[18px] w-[18px]" /></button>
                </div></td>
              </tr>;
            })}</tbody>
          </table>
        </div>
        <div className="border-t border-border px-5 py-3 text-[13px] text-slate-500">Hiển thị <span className="font-semibold text-slate-700">{filtered.length}</span> / {data?.length ?? 0} kỳ thi</div>
      </Card>}
    </>}
    <ExamFormModal open={open} onClose={()=>setParams({})} onSaved={(exam)=>nav(`/exams/${exam.id}`)} />
    <ExamFormModal open={!!editing} exam={editing ?? undefined} onClose={()=>setEditing(null)} />
  </div>;
}
