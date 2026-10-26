import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, FileDown } from "lucide-react";
import { Link, NavLink, Outlet, useOutletContext, useParams } from "react-router-dom";
import { Button, PageLoader } from "../../components/ui";
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
    { to: "", label: "Tổng quan", end: true },
    { to: "keys", label: "Đáp án", count: exam.num_keys },
    { to: "students", label: "Thí sinh", count: exam.num_students },
    { to: "sheets", label: "In phiếu" },
    { to: "grade", label: "Chấm bài" },
    { to: "results", label: "Kết quả", count: exam.num_submissions, warn: exam.num_review },
    { to: "stats", label: "Thống kê" },
  ];
  const meta = [
    exam.subject,
    exam.exam_date && new Date(exam.exam_date).toLocaleDateString("vi-VN"),
    `${exam.num_questions} câu, ${exam.num_options} phương án`,
    `thang ${exam.max_score}, đạt từ ${exam.pass_score}`,
    `mã kỳ thi #${exam.id}`,
  ].filter(Boolean);

  return (
    <div>
      <Link to="/exams" className="mb-2 inline-flex items-center gap-1 text-[13px] text-slate-500 hover:text-slate-900">
        <ChevronLeft className="h-3.5 w-3.5" /> Kỳ thi
      </Link>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-[30px] font-semibold leading-tight text-slate-900">{exam.name}</h1>
          <p className="mt-1.5 text-[13.5px] text-slate-500">{meta.join(" · ")}</p>
        </div>
        <Button variant="secondary" icon={<FileDown />} onClick={() => downloadUrl(`/api/exams/${exam.id}/export.xlsx`)}>
          Xuất Excel
        </Button>
      </div>
      <div className="mb-7 overflow-x-auto border-b border-slate-200">
        <nav className="-mb-px flex gap-6">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                cn(
                  "flex items-baseline gap-1.5 whitespace-nowrap border-b-2 pb-2.5 pt-1 text-[14px] transition-colors",
                  isActive ? "border-slate-900 font-medium text-slate-900" : "border-transparent text-slate-500 hover:text-slate-900",
                )
              }
            >
              {t.label}
              {!!t.count && <span className="text-[12px] tabular text-slate-400">{t.count}</span>}
              {!!t.warn && <span className="text-[12px] font-semibold tabular text-mark">· {t.warn} cần xem</span>}
            </NavLink>
          ))}
        </nav>
      </div>
      <Outlet context={{ exam }} />
    </div>
  );
}
