import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, ClipboardList, FileCheck2, FlaskConical, Gauge, Plus, Timer } from "lucide-react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button, Card, CardHeader, Empty, PageHeader, PageLoader, StatCard, StatusBadge } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { Dashboard as D } from "../lib/types";
import { fmtScore, scoreColor, timeAgo } from "../lib/utils";

export const ACTION_LABEL: Record<string, string> = {
  upload: "chấm bài",
  edit: "sửa bài làm",
  reset: "khôi phục kết quả máy",
  create_exam: "tạo kỳ thi",
  save_key: "lưu đáp án",
  delete_submission: "xóa bài làm",
};

export default function Dashboard() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: () => api.get<D>("/api/dashboard") });
  if (isLoading || !data) return <PageLoader />;
  const hour = new Date().getHours();
  const greet = hour < 11 ? "Chào buổi sáng" : hour < 14 ? "Chào buổi trưa" : hour < 18 ? "Chào buổi chiều" : "Chào buổi tối";

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={`${greet}, ${user?.full_name || user?.username}!`}
        subtitle="Tổng quan hoạt động chấm thi của bạn."
        actions={
          <>
            <Link to="/lab">
              <Button variant="secondary" icon={<FlaskConical className="h-4 w-4" />}>
                Phòng thí nghiệm
              </Button>
            </Link>
            <Link to="/exams?new=1">
              <Button icon={<Plus className="h-4 w-4" />}>Tạo kỳ thi</Button>
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Kỳ thi" value={data.exams} icon={<ClipboardList className="h-5 w-5" />} />
        <StatCard label="Bài đã chấm" value={data.submissions} icon={<FileCheck2 className="h-5 w-5" />} tone="green"
          hint={data.errors ? `${data.errors} ảnh lỗi` : undefined} />
        <StatCard label="Cần xem lại" value={data.review} icon={<AlertTriangle className="h-5 w-5" />} tone="amber" />
        <StatCard label="Điểm trung bình" value={fmtScore(data.avg_score)} icon={<Gauge className="h-5 w-5" />} tone="violet"
          hint={data.avg_ms ? <span className="inline-flex items-center gap-1"><Timer className="h-3 w-3" /> {Math.round(data.avg_ms)} ms/phiếu</span> : undefined} />
      </div>

      {data.exams === 0 ? (
        <Card className="mt-6">
          <Empty
            icon={<ClipboardList className="h-6 w-6" />}
            title="Chưa có kỳ thi nào"
            description="Tạo kỳ thi đầu tiên, in phiếu trả lời, rồi chụp ảnh bài làm để hệ thống chấm tự động."
            action={
              <Link to="/exams?new=1">
                <Button icon={<Plus className="h-4 w-4" />}>Tạo kỳ thi</Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="mt-6 grid gap-6 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader title="Điểm trung bình theo kỳ thi" subtitle="Các kỳ thi gần đây nhất" />
            <div className="h-72 px-2 py-4">
              <ResponsiveContainer>
                <BarChart data={[...data.per_exam].reverse()} margin={{ left: -10, right: 16 }}>
                  <CartesianGrid vertical={false} stroke="#eef2f7" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} interval={0}
                    tickFormatter={(v: string) => (v.length > 16 ? v.slice(0, 15) + "…" : v)} />
                  <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} />
                  <Tooltip cursor={{ fill: "#f1f5f9" }} formatter={(v: number) => [fmtScore(v), "Điểm TB"]} />
                  <Bar dataKey="avg" fill="#2547ea" radius={[6, 6, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <CardHeader title="Hoạt động gần đây" />
            <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
              {data.activity.length === 0 && <li className="px-5 py-6 text-sm text-slate-500">Chưa có hoạt động.</li>}
              {data.activity.map((a) => (
                <li key={a.id} className="flex items-start gap-3 px-5 py-3 text-sm">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                  <div className="min-w-0">
                    <p className="text-slate-700">
                      <b className="font-medium text-slate-900">{a.user || "Hệ thống"}</b> {ACTION_LABEL[a.action] ?? a.action}
                      {a.action === "upload" && typeof a.detail.sbd === "string" && <> — SBD {a.detail.sbd}</>}
                      {a.action === "create_exam" && typeof a.detail.name === "string" && <> “{a.detail.name}”</>}
                    </p>
                    <p className="text-xs text-slate-400">{timeAgo(a.created_at)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="xl:col-span-3">
            <CardHeader title="Bài chấm gần đây" actions={<Link to="/exams" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">Tất cả kỳ thi <ArrowRight className="h-4 w-4" /></Link>} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-2.5">SBD</th>
                    <th className="px-5 py-2.5">Thí sinh</th>
                    <th className="px-5 py-2.5">Kỳ thi</th>
                    <th className="px-5 py-2.5 text-right">Điểm</th>
                    <th className="px-5 py-2.5">Trạng thái</th>
                    <th className="px-5 py-2.5">Thời gian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.recent.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="px-5 py-2.5 font-mono tabular">
                        <Link to={`/submissions/${s.id}`} className="text-brand-700 hover:underline">{s.sbd || "—"}</Link>
                      </td>
                      <td className="px-5 py-2.5">{s.name || <span className="text-slate-400">—</span>}</td>
                      <td className="px-5 py-2.5 text-slate-600">{s.exam_name}</td>
                      <td className={`px-5 py-2.5 text-right font-semibold tabular ${scoreColor(s.score)}`}>{fmtScore(s.score)}</td>
                      <td className="px-5 py-2.5"><StatusBadge status={s.status} /></td>
                      <td className="px-5 py-2.5 text-slate-500">{timeAgo(s.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
