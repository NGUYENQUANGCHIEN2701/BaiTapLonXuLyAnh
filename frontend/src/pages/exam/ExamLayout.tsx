import { useQuery } from "@tanstack/react-query";
import { Activity, ArrowLeft, BarChart3, CalendarDays, CheckCircle2, CircleCheck, ClipboardList, FileDown, LayoutDashboard, ListChecks, Printer, ScanLine, UsersRound } from "lucide-react";
import { Link, NavLink, Outlet, useOutletContext, useParams } from "react-router-dom";
import { Button, Card, Empty, PageLoader } from "../../components/ui";
import { api } from "../../lib/api";
import type { Exam } from "../../lib/types";
import { cn, downloadUrl } from "../../lib/utils";

export function useExam() {
  return useOutletContext<{ exam: Exam }>().exam;
}

export function useExamQuery(id: number, enabled = true) {
  return useQuery({ queryKey: ["exam", id], queryFn: () => api.get<Exam>(`/api/exams/${id}`), enabled });
}

function ExamSheetArt() {
  return <svg viewBox="0 0 360 165" className="h-[150px] w-full max-w-[370px]" aria-hidden="true">
    <path d="M0 137c85-74 152-49 218-17s99 15 142-8v53H0Z" fill="#DBEEFF"/><path d="M28 152c72-33 137-19 192-4s88 5 140-25v42H28Z" fill="#C8E5FF" />
    <g transform="rotate(8 175 80)"><rect x="111" y="11" width="143" height="133" rx="12" fill="white" stroke="#B7D8FA" strokeWidth="3" />
      {[0,1,2,3].map((c)=><text key={c} x={158+c*21} y="37" textAnchor="middle" fontFamily="sans-serif" fontWeight="700" fontSize="12" fill="#365987">{"ABCD"[c]}</text>)}
      {[0,1,2].map((r)=><g key={r}><text x="137" y={63+r*22} textAnchor="middle" fontFamily="sans-serif" fontWeight="700" fontSize="11" fill="#31527B">{r+1}</text>{[0,1,2,3].map((c)=><circle key={c} cx={158+c*21} cy={59+r*22} r="7" fill={(r+c)%3===1?"#1686DF":"white"} stroke="#9FC9F5" strokeWidth="1.7" />)}</g>)}
    </g>
    <path d="M110 9H98q-10 0-10 10v14m168-24h12q10 0 10 10v14M112 146H99q-10 0-10-10v-13m169 23h12q10 0 10-10v-13" fill="none" stroke="#0879E2" strokeWidth="4" strokeLinecap="round" />
    <path d="m269 77 39-54q5-7 11-2t1 12l-39 56-15 11Z" fill="#0876D1"/><path d="m265 83 15 8-12 8-8-3Z" fill="#0D467E"/>
  </svg>;
}

export default function ExamLayout() {
  const id = Number(useParams().examId);
  const { data: exam, isLoading, error } = useExamQuery(id);
  if (isLoading) return <PageLoader />;
  if (!exam) return <Card><Empty title={(error as Error)?.message ?? "Không tìm thấy kỳ thi"} description="Bạn hãy kiểm tra đường dẫn hoặc quay lại danh sách kỳ thi." action={<Link to="/exams"><Button>Về danh sách kỳ thi</Button></Link>} /></Card>;

  const tabs = [
    { to: "", label: "Tổng quan", end: true, icon: <LayoutDashboard /> },
    { to: "keys", label: "Đáp án", count: exam.num_keys, icon: <CircleCheck /> },
    { to: "students", label: "Thí sinh", count: exam.num_students, icon: <UsersRound /> },
    { to: "sheets", label: "In phiếu", icon: <Printer /> },
    { to: "grade", label: "Chấm bài", icon: <ScanLine /> },
    { to: "results", label: "Kết quả", count: exam.num_submissions, warn: exam.num_review, icon: <ListChecks /> },
    { to: "stats", label: "Thống kê", icon: <BarChart3 /> },
  ];

  return <div>
    <section className="relative mb-1 grid min-h-[164px] grid-cols-1 items-center overflow-hidden rounded-2xl bg-primary-softer px-4 py-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(250px,380px)] lg:px-7">
      <div className="relative z-[1] min-w-0">
        <Link to="/exams" className="mb-2 inline-flex items-center gap-2 text-[14px] font-medium text-primary-hover hover:underline"><ArrowLeft className="h-4 w-4" />Kỳ thi</Link>
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-[64px] w-[64px] shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary"><CalendarDays className="h-9 w-9" /></span>
          <h1 className="max-w-full break-words text-[32px] font-bold leading-tight tracking-tight text-navy sm:text-[40px]">{exam.name}</h1>
          {exam.num_submissions > 0 && <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1.5 text-[14px] font-semibold text-[#166534]"><CheckCircle2 className="h-4 w-4" />Đã chấm</span>}
        </div>
        <div className="mt-3 flex max-w-[880px] flex-wrap items-center gap-x-3 gap-y-2 text-[13px] font-medium text-slate-700 sm:text-[14px]">
          {exam.subject && <span className="inline-flex items-center gap-1.5"><ClipboardList className="h-4 w-4 text-slate-500" />{exam.subject}</span>}
          {exam.exam_date && <span className="inline-flex items-center gap-1.5 border-l border-border pl-3"><CalendarDays className="h-4 w-4 text-slate-500" />{new Date(`${exam.exam_date}T00:00:00`).toLocaleDateString("vi-VN")}</span>}
          <span className="inline-flex items-center gap-1.5 border-l border-border pl-3"><ListChecks className="h-4 w-4 text-slate-500" />{exam.num_questions} câu</span>
          <span className="inline-flex items-center gap-1.5 border-l border-border pl-3"><CircleCheck className="h-4 w-4 text-slate-500" />{exam.num_options} phương án</span>
          <span className="inline-flex items-center gap-1.5 border-l border-border pl-3"><CalendarDays className="h-4 w-4 text-slate-500" />Thang {exam.max_score}</span>
          <span className="inline-flex items-center gap-1.5 border-l border-border pl-3"><Activity className="h-4 w-4 text-slate-500" />Kỳ thi #{exam.id}</span>
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-0 right-[130px] top-0 hidden w-[min(42%,420px)] items-center justify-center lg:flex"><ExamSheetArt /></div>
      <div className="relative z-[1] mt-3 flex justify-end lg:mt-0"><Button variant="secondary" icon={<FileDown />} onClick={() => downloadUrl(`/api/exams/${exam.id}/export.xlsx`)}>Xuất Excel</Button></div>
    </section>

    <Card className="mb-6 overflow-hidden border-primary-soft p-1">
      <div className="overflow-x-auto">
        <nav className="flex min-w-max items-stretch justify-between gap-1" aria-label="Các mục của kỳ thi">
          {tabs.map((tab) => <NavLink key={tab.to} to={tab.to} end={tab.end} className={({isActive})=>cn("relative flex min-h-[54px] items-center gap-2 rounded-lg px-3 text-[14px] font-medium transition-colors sm:px-4 sm:text-[15px]",isActive?"bg-primary-softer font-semibold text-primary-hover after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:rounded-full after:bg-primary":"text-slate-600 hover:bg-surface hover:text-primary-hover")}>
            <span className="[&_svg]:h-5 [&_svg]:w-5">{tab.icon}</span><span>{tab.label}</span>{!!tab.count&&<span className="rounded-full bg-slate-100 px-2 py-0.5 text-[12px] tabular text-slate-700">{tab.count}</span>}{!!tab.warn&&<span className="rounded-full bg-warning-soft px-2 py-0.5 text-[12px] font-semibold tabular text-text">{tab.warn}</span>}
          </NavLink>)}
        </nav>
      </div>
    </Card>
    <Outlet context={{ exam }} />
  </div>;
}
