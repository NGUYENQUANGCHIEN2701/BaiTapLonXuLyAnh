import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  FileText,
  FlaskConical,
  ListChecks,
  Plus,
  ScanLine,
  Timer,
  TrendingUp,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button, Card, Empty, PageLoader, StatusBadge } from "../components/ui";
import { api } from "../lib/api";
import type { Dashboard as D, Exam } from "../lib/types";
import { fmtScore, scoreColor, timeAgo } from "../lib/utils";

export const ACTION_LABEL: Record<string, string> = {
  upload: "chấm bài",
  edit: "sửa bài làm",
  reset: "khôi phục kết quả máy",
  create_exam: "tạo kỳ thi",
  save_key: "lưu đáp án",
  delete_submission: "xóa bài làm",
};

function today() {
  const s = new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Metric({ label, value, icon, tone = "blue", hint }: { label: string; value: string | number; icon: React.ReactNode; tone?: "blue" | "green" | "amber"; hint?: string }) {
  const toneClass = {
    blue: "bg-primary-soft text-primary",
    green: "bg-success-soft text-success",
    amber: "bg-warning-soft text-warning",
  }[tone];
  const decorative = { blue: "text-primary/20", green: "text-success/20", amber: "text-warning/25" }[tone];
  return (
    <Card className={`relative min-h-[112px] overflow-hidden p-4 sm:p-5 ${tone === "amber" ? "border-warning" : ""}`}>
      <div className="relative z-[1] flex items-center gap-2.5">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${toneClass} [&_svg]:h-5 [&_svg]:w-5`}>{icon}</span>
        <span className="text-[14px] font-medium text-slate-700">{label}</span>
      </div>
      <div className="relative z-[1] mt-2 pl-0.5">
        <p className={`text-[27px] font-bold leading-none tabular ${tone === "amber" ? "text-warning" : "text-navy"}`}>{value}</p>
        {hint && <p className="mt-1 text-[12px] leading-4 text-text-muted">{hint}</p>}
      </div>
      <span aria-hidden className={`absolute -bottom-1 right-2 [&_svg]:h-[68px] [&_svg]:w-[68px] ${decorative}`}>{icon}</span>
    </Card>
  );
}

function GradingFlow() {
  const steps = [
    { label: <>Tải lên phiếu<br />trả lời</>, icon: <Upload /> },
    { label: <>Quét &amp; nhận dạng<br />OMR</>, icon: <ScanLine /> },
    { label: <>Tự động<br />chấm điểm</>, icon: <CheckCircle2 /> },
    { label: <>Thống kê &amp;<br />xuất kết quả</>, icon: <BarChart3 /> },
  ];
  return (
    <section aria-label="Quy trình chấm OMR" className="grid grid-cols-1 gap-4 rounded-xl border border-border bg-primary-softer px-4 py-4 sm:grid-cols-[minmax(155px,1.1fr)_repeat(4,minmax(0,1fr))] sm:items-center sm:px-5">
      <div className="flex items-center gap-3 text-navy">
        <ScanLine className="h-7 w-7 shrink-0 text-primary" />
        <p className="text-[14px] font-semibold leading-5">Quy trình chấm OMR<br /><span className="font-normal">(tự động)</span></p>
      </div>
      {steps.map((step, index) => (
        <div key={index} className="flex items-center justify-between gap-2 sm:justify-center">
          <div className="relative flex min-w-0 flex-1 flex-col items-center gap-1 text-center text-[13px] leading-4 text-slate-700 sm:flex-none">
            <span className="relative text-primary [&_svg]:h-6 [&_svg]:w-6">{step.icon}<span className="absolute -right-2 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-success text-white [&_svg]:h-3 [&_svg]:w-3"><Check /></span></span>
            <span>{step.label}</span>
          </div>
          {index < steps.length - 1 && <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 sm:hidden" />}
          {index < steps.length - 1 && <ChevronRight className="hidden h-5 w-5 shrink-0 text-slate-400 sm:block" />}
        </div>
      ))}
    </section>
  );
}

export default function Dashboard() {
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: () => api.get<D>("/api/dashboard") });
  const { data: exams } = useQuery({ queryKey: ["exams"], queryFn: () => api.get<Exam[]>("/api/exams") });
  if (isLoading || !data) return <PageLoader />;
  const pending = (exams ?? []).filter((e) => e.num_review > 0);

  return (
    <div className="dashboard-page">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4 sm:mb-6">
        <div className="min-w-0">
          <p className="mb-2 flex items-center gap-2 text-[14px] text-slate-600"><ClipboardList className="h-[18px] w-[18px] text-slate-500" />{today()}</p>
          <h1 className="text-[32px] font-bold leading-tight tracking-tight text-navy sm:text-[38px]">Tổng quan</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/lab"><Button variant="secondary" size="sm" icon={<FlaskConical />}>Phòng thí nghiệm</Button></Link>
          <Link to="/exams?new=1"><Button size="sm" icon={<Plus />}>Tạo kỳ thi</Button></Link>
        </div>
      </header>

      <section aria-label="Thống kê tổng quan" className="mb-6 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-5">
        <Metric label="Kỳ thi" value={data.exams} icon={<ClipboardList />} />
        <Metric label="Bài đã chấm" value={data.submissions} icon={<CheckCircle2 />} tone="green" hint={data.errors ? `${data.errors} ảnh không đọc được` : undefined} />
        <Metric label="Cần xem lại" value={data.review} icon={<TriangleAlert />} tone="amber" />
        <Metric label="Điểm trung bình" value={fmtScore(data.avg_score)} icon={<TrendingUp />} />
        <Metric label="Thời gian chấm" value={data.avg_ms ? Math.round(data.avg_ms) : "—"} icon={<Timer />} hint="mili giây / phiếu" />
      </section>

      {data.exams === 0 ? (
        <Card><Empty title="Chưa có kỳ thi nào" description="Tạo kỳ thi, in phiếu trả lời, rồi chụp ảnh bài làm — hệ thống sẽ chấm và gom các bài cần xem lại cho bạn." action={<Link to="/exams?new=1"><Button variant="secondary" icon={<Plus />}>Tạo kỳ thi đầu tiên</Button></Link>} /></Card>
      ) : (
        <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.9fr)_minmax(290px,0.9fr)]">
          <div className="min-w-0 space-y-4">
            {pending.length > 0 && (
              <Card className="overflow-hidden border-l-[3px] border-l-warning">
                <div className="flex items-start gap-3 px-4 py-4 sm:px-5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning-soft text-warning"><TriangleAlert className="h-5 w-5" /></span>
                  <div className="min-w-0">
                    <h2 className="text-[18px] font-bold leading-6 text-navy">Việc cần làm</h2>
                    <p className="mt-0.5 text-[14px] leading-5 text-slate-600">Các bài máy chưa chắc chắn — tô mờ, tô nhiều ô, SBD hoặc mã đề lạ.</p>
                  </div>
                </div>
                <ul className="divide-y divide-border border-t border-border">
                  {pending.map((e) => (
                    <li key={e.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warning-soft text-warning"><FileText className="h-[18px] w-[18px]" /></span>
                      <div className="min-w-0 flex-1"><div className="truncate text-[15px] font-semibold text-navy">{e.name}</div><div className="text-[13px] text-slate-500">{e.subject || "—"}</div></div>
                      <span className="shrink-0 text-[14px] tabular text-slate-700"><b className="font-semibold">{e.num_review}</b> bài</span>
                      <Link to={`/exams/${e.id}/results?status=review`} className="inline-flex min-h-9 shrink-0 items-center rounded-lg border border-primary px-3 text-[14px] font-semibold text-primary-hover hover:bg-primary-softer">Duyệt</Link>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            <GradingFlow />

            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
                <h2 className="flex items-center gap-2.5 text-[18px] font-bold text-navy"><ListChecks className="h-6 w-6 text-primary" />Bài chấm gần đây</h2>
                <Link to="/exams" className="inline-flex items-center gap-1 text-[14px] font-semibold text-primary-hover hover:underline">Tất cả kỳ thi <ArrowRight className="h-4 w-4" /></Link>
              </div>
              {data.recent.length ? <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-[14px]">
                  <thead className="text-left text-[13px]"><tr className="border-b border-border">
                    <th className="px-4 py-2.5 font-semibold sm:px-5">SBD</th><th className="px-4 py-2.5 font-semibold">Thí sinh</th><th className="px-4 py-2.5 font-semibold">Kỳ thi</th><th className="px-4 py-2.5 text-right font-semibold">Điểm</th><th className="px-4 py-2.5 font-semibold">Trạng thái</th><th className="px-4 py-2.5 text-right font-semibold sm:px-5">Lúc</th>
                  </tr></thead>
                  <tbody className="divide-y divide-border">{data.recent.map((s) => (
                    <tr key={s.id}>
                      <td className="whitespace-nowrap px-4 py-2.5 font-sans text-[14px] sm:px-5"><Link to={`/submissions/${s.id}`} className="font-medium text-primary-hover hover:underline">{s.sbd || "——————"}</Link></td>
                      <td className="max-w-[170px] truncate px-4 py-2.5 font-medium text-slate-800">{s.name || <span className="font-normal text-text-muted">không rõ</span>}</td>
                      <td className="max-w-[190px] truncate px-4 py-2.5 text-slate-600">{s.exam_name}</td>
                      <td className={`whitespace-nowrap px-4 py-2.5 text-right font-sans text-[16px] font-semibold tabular ${scoreColor(s.score)}`}>{fmtScore(s.score)}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={s.status} /></td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right text-[13px] text-slate-500 sm:px-5">{timeAgo(s.created_at)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div> : <div className="px-5 py-8 text-center text-[14px] text-slate-500">Chưa có bài làm nào được chấm.</div>}
            </Card>
          </div>

          <aside className="min-w-0 space-y-4">
            <Card className="overflow-hidden">
              <div className="flex items-center gap-3 border-b border-border px-4 py-4 sm:px-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary"><BarChart3 className="h-5 w-5" /></span>
                <div><h2 className="text-[18px] font-bold text-navy">Điểm trung bình</h2><p className="text-[13px] text-slate-500">Thang 10</p></div>
              </div>
              {data.per_exam.length ? <ul className="space-y-4 px-4 py-4 sm:px-5">{data.per_exam.map((e) => (
                <li key={e.id}><Link to={`/exams/${e.id}/stats`} className="group block">
                  <div className="flex items-baseline justify-between gap-3 text-[14px]"><span className="truncate font-semibold text-slate-800 group-hover:text-primary-hover">{e.name}</span><span className="font-sans text-[18px] font-bold tabular text-primary-hover">{fmtScore(e.avg, 1)}</span></div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, ((e.avg ?? 0) / 10) * 100))}%` }} /></div>
                  <div className="mt-1 text-[13px] text-slate-500">{e.count} bài</div>
                </Link></li>
              ))}</ul> : <p className="px-5 py-6 text-[14px] text-slate-500">Chưa có dữ liệu điểm.</p>}
            </Card>

            <Card className="overflow-hidden">
              <div className="flex items-center gap-3 border-b border-border px-4 py-4 sm:px-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary"><Clock3 className="h-5 w-5" /></span>
                <h2 className="text-[18px] font-bold text-navy">Hoạt động</h2>
              </div>
              {data.activity.length ? <ol className="relative space-y-0 px-4 py-2 sm:px-5">{data.activity.map((a, i) => (
                <li key={a.id} className="relative flex gap-3 py-2.5">
                  {i < data.activity.length - 1 && <span aria-hidden className="absolute bottom-[-10px] left-[9px] top-10 w-px bg-border" />}
                  <span className="relative z-[1] mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"><FileText className="h-[17px] w-[17px]" /></span>
                  <div className="min-w-0 flex-1"><p className="text-[14px] leading-5 text-slate-700"><span className="font-semibold text-navy">{a.user || "Hệ thống"}</span> {ACTION_LABEL[a.action] ?? a.action}{a.action === "upload" && typeof a.detail.sbd === "string" && <span className="font-sans"> {a.detail.sbd}</span>}{a.action === "create_exam" && typeof a.detail.name === "string" && <> “{a.detail.name}”</>}</p><p className="mt-0.5 text-[13px] text-slate-500">{timeAgo(a.created_at)}</p></div>
                </li>
              ))}</ol> : <p className="px-5 py-6 text-[14px] text-slate-500">Chưa có hoạt động.</p>}
            </Card>
          </aside>
        </div>
      )}
    </div>
  );
}
