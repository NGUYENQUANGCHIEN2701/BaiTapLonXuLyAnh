import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { Button, Card, CardHeader, Empty, PageHeader, PageLoader, StatCard, StatStrip, StatusBadge } from "../components/ui";
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

export default function Dashboard() {
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: () => api.get<D>("/api/dashboard") });
  const { data: exams } = useQuery({ queryKey: ["exams"], queryFn: () => api.get<Exam[]>("/api/exams") });
  if (isLoading || !data) return <PageLoader />;
  const pending = (exams ?? []).filter((e) => e.num_review > 0);

  return (
    <div>
      <PageHeader
        eyebrow={today()}
        title="Tổng quan"
        actions={
          <>
            <Link to="/lab">
              <Button variant="secondary">Phòng thí nghiệm</Button>
            </Link>
            <Link to="/exams?new=1">
              <Button icon={<Plus />}>Tạo kỳ thi</Button>
            </Link>
          </>
        }
      />

      <StatStrip>
        <StatCard label="Kỳ thi" value={data.exams} />
        <StatCard label="Bài đã chấm" value={data.submissions} hint={data.errors ? `${data.errors} ảnh không đọc được` : undefined} />
        <StatCard label="Cần xem lại" value={data.review} tone={data.review ? "amber" : undefined} />
        <StatCard label="Điểm trung bình" value={fmtScore(data.avg_score)} />
        <StatCard label="Thời gian chấm" value={data.avg_ms ? Math.round(data.avg_ms) : "—"} hint="mili giây / phiếu" />
      </StatStrip>

      {data.exams === 0 ? (
        <Card className="mt-6">
          <Empty
            title="Chưa có kỳ thi nào"
            description="Tạo kỳ thi, in phiếu trả lời, rồi chụp ảnh bài làm — hệ thống sẽ chấm và gom các bài cần xem lại cho bạn."
            action={
              <Link to="/exams?new=1">
                <Button icon={<Plus />}>Tạo kỳ thi đầu tiên</Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_340px]">
          <div className="min-w-0 space-y-6">
            {pending.length > 0 && (
              <Card className="border-l-[3px] border-l-[#d08700]">
                <div className="px-5 py-4">
                  <h3 className="text-[15px] font-semibold">Việc cần làm</h3>
                  <p className="mt-0.5 text-[13px] text-slate-500">Các bài máy chưa chắc chắn — tô mờ, tô nhiều ô, SBD hoặc mã đề lạ.</p>
                </div>
                <ul className="divide-y divide-slate-200 border-t border-slate-200">
                  {pending.map((e) => (
                    <li key={e.id} className="flex items-center gap-4 px-5 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{e.name}</div>
                        <div className="text-[12px] text-slate-500">{e.subject || "—"}</div>
                      </div>
                      <span className="text-sm tabular text-slate-700">
                        <b className="font-semibold">{e.num_review}</b> bài
                      </span>
                      <Link to={`/exams/${e.id}/results?status=review`} className="text-sm font-medium text-slate-900 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-900">
                        Duyệt
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            <Card>
              <CardHeader
                title="Bài chấm gần đây"
                actions={
                  <Link to="/exams" className="inline-flex items-center gap-1 text-[13px] text-slate-600 hover:text-slate-900">
                    Tất cả kỳ thi <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                }
              />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-[12px] text-slate-500">
                    <tr className="border-b border-slate-200">
                      <th className="px-5 py-2 font-normal">SBD</th>
                      <th className="px-5 py-2 font-normal">Thí sinh</th>
                      <th className="px-5 py-2 font-normal">Kỳ thi</th>
                      <th className="px-5 py-2 text-right font-normal">Điểm</th>
                      <th className="px-5 py-2 font-normal">Trạng thái</th>
                      <th className="px-5 py-2 text-right font-normal">Lúc</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.recent.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="px-5 py-2.5 font-mono text-[13px]">
                          <Link to={`/submissions/${s.id}`} className="hover:underline">
                            {s.sbd || "——————"}
                          </Link>
                        </td>
                        <td className="px-5 py-2.5">{s.name || <span className="text-slate-400">không rõ</span>}</td>
                        <td className="max-w-[220px] truncate px-5 py-2.5 text-slate-600">{s.exam_name}</td>
                        <td className={`px-5 py-2.5 text-right font-display text-[17px] tabular ${scoreColor(s.score)}`}>{fmtScore(s.score)}</td>
                        <td className="px-5 py-2.5">
                          <StatusBadge status={s.status} />
                        </td>
                        <td className="whitespace-nowrap px-5 py-2.5 text-right text-[13px] text-slate-500">{timeAgo(s.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader title="Điểm trung bình" subtitle="Thang 10" />
              <ul className="space-y-3.5 px-5 py-4">
                {data.per_exam.map((e) => (
                  <li key={e.id}>
                    <Link to={`/exams/${e.id}/stats`} className="group block">
                      <div className="flex items-baseline justify-between gap-3 text-[13px]">
                        <span className="truncate text-slate-700 group-hover:text-slate-900 group-hover:underline">{e.name}</span>
                        <span className="font-display text-[17px] tabular">{fmtScore(e.avg, 1)}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 rounded-full bg-slate-200">
                        <div className="h-full rounded-full bg-slate-900" style={{ width: `${((e.avg ?? 0) / 10) * 100}%` }} />
                      </div>
                      <div className="mt-1 text-[11.5px] text-slate-500">{e.count} bài</div>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <CardHeader title="Hoạt động" />
              <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
                {data.activity.length === 0 && <li className="px-5 py-6 text-sm text-slate-500">Chưa có hoạt động.</li>}
                {data.activity.map((a) => (
                  <li key={a.id} className="flex items-baseline gap-3 px-5 py-2.5 text-[13px]">
                    <p className="min-w-0 flex-1 text-slate-700">
                      <span className="font-medium text-slate-900">{a.user || "Hệ thống"}</span> {ACTION_LABEL[a.action] ?? a.action}
                      {a.action === "upload" && typeof a.detail.sbd === "string" && <span className="font-mono text-[12px]"> {a.detail.sbd}</span>}
                      {a.action === "create_exam" && typeof a.detail.name === "string" && <> “{a.detail.name}”</>}
                    </p>
                    <span className="shrink-0 text-[11.5px] text-slate-400">{timeAgo(a.created_at)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
