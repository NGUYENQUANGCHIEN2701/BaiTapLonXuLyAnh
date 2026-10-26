import { useQuery } from "@tanstack/react-query";
import { BarChart3, ChevronLeft, FileDown, KeyRound, LayoutGrid, ListChecks, Printer, ScanLine, Users } from "lucide-react";
import { Link, NavLink, Outlet, useOutletContext, useParams } from "react-router-dom";
import { Badge, Button, PageLoader } from "../../components/ui";
import { api } from "../../lib/api";
import type { Exam } from "../../lib/types";
import { cn, downloadUrl } from "../../lib/utils";

export function useExam() {
  return useOutletContext<{ exam: Exam }>().exam;
}

export function useExamQuery(id: number, enabled = true) {
  return useQuery({ queryKey: ["exam", id], queryFn: () => api.get<Exam>(`/api/exams/${id}`), enabled });
}

export default function ExamLayout() {
  const id = Number(useParams().examId);
  const { data: exam, isLoading, error } = useExamQuery(id);
  if (isLoading) return <PageLoader />;
  if (!exam) return <div className="p-8 text-center text-slate-500">{(error as Error)?.message ?? "Không tìm thấy kỳ thi"}</div>;

  const tabs = [
    { to: "", label: "Tổng quan", icon: LayoutGrid, end: true },
    { to: "keys", label: "Đáp án", icon: KeyRound, count: exam.num_keys },
    { to: "students", label: "Thí sinh", icon: Users, count: exam.num_students },
    { to: "sheets", label: "In phiếu", icon: Printer },
    { to: "grade", label: "Chấm bài", icon: ScanLine },
    { to: "results", label: "Kết quả", icon: ListChecks, count: exam.num_submissions, warn: exam.num_review },
    { to: "stats", label: "Thống kê", icon: BarChart3 },
  ];

  return (
    <div className="animate-fade-in">
      <Link to="/exams" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ChevronLeft className="h-4 w-4" /> Kỳ thi
      </Link>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{exam.name}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            {exam.subject && <span>{exam.subject}</span>}
            {exam.exam_date && <span>· {new Date(exam.exam_date).toLocaleDateString("vi-VN")}</span>}
            <Badge tone="blue">{exam.num_questions} câu · {exam.num_options} phương án</Badge>
            <Badge tone="gray">Thang {exam.max_score} · đạt ≥ {exam.pass_score}</Badge>
            <Badge tone="gray">Mã kỳ thi #{exam.id}</Badge>
          </div>
        </div>
        <Button variant="secondary" icon={<FileDown className="h-4 w-4" />} onClick={() => downloadUrl(`/api/exams/${exam.id}/export.xlsx`)}>
          Xuất Excel
        </Button>
      </div>
      <div className="mb-6 overflow-x-auto border-b border-slate-200">
        <nav className="-mb-px flex gap-1">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800",
                )
              }
            >
              <t.icon className="h-4 w-4" />
              {t.label}
              {t.count !== undefined && t.count > 0 && <span className="rounded-full bg-slate-100 px-1.5 text-[11px] text-slate-600">{t.count}</span>}
              {!!t.warn && <span className="rounded-full bg-amber-100 px-1.5 text-[11px] font-semibold text-amber-800">{t.warn}</span>}
            </NavLink>
          ))}
        </nav>
      </div>
      <Outlet context={{ exam }} />
    </div>
  );
}
