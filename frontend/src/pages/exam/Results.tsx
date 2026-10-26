import { useQuery } from "@tanstack/react-query";
import { ArrowDownUp, ListChecks, PlayCircle, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Badge, Button, Card, Empty, Input, PageLoader, Segmented, StatusBadge } from "../../components/ui";
import { api } from "../../lib/api";
import type { SubmissionBrief } from "../../lib/types";
import { cn, FLAG_LABEL, fmtScore, scoreColor, timeAgo } from "../../lib/utils";
import { useExam } from "./ExamLayout";

type SortKey = "id" | "sbd" | "score" | "confidence";

export default function Results() {
  const exam = useExam();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = (params.get("status") ?? "") as "" | "graded" | "review" | "error";
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "id", dir: -1 });
  const { data, isLoading } = useQuery({
    queryKey: ["submissions", exam.id],
    queryFn: () => api.get<SubmissionBrief[]>(`/api/exams/${exam.id}/submissions`),
  });

  const counts = useMemo(() => {
    const c = { "": 0, graded: 0, review: 0, error: 0 } as Record<string, number>;
    (data ?? []).forEach((s) => {
      c[""]++;
      c[s.status]++;
    });
    return c;
  }, [data]);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = (data ?? []).filter(
      (x) => (!status || x.status === status) && (!s || x.sbd.includes(s) || x.student_name.toLowerCase().includes(s) || x.source_name.toLowerCase().includes(s)),
    );
    const val = (x: SubmissionBrief) => (sort.key === "score" ? (x.score ?? -1) : sort.key === "confidence" ? x.confidence : sort.key === "sbd" ? x.sbd : x.id);
    return [...list].sort((a, b) => (val(a) > val(b) ? sort.dir : val(a) < val(b) ? -sort.dir : 0));
  }, [data, q, status, sort]);

  const th = (key: SortKey, label: string, right = false) => (
    <th className={cn("px-4 py-2.5", right && "text-right")}>
      <button className="inline-flex items-center gap-1 hover:text-slate-900" onClick={() => setSort((s) => ({ key, dir: s.key === key ? (-s.dir as 1 | -1) : -1 }))}>
        {label}
        <ArrowDownUp className={cn("h-3 w-3", sort.key === key ? "text-slate-900" : "text-slate-300")} />
      </button>
    </th>
  );

  if (isLoading) return <PageLoader />;
  const firstReview = (data ?? []).filter((s) => s.status === "review").sort((a, b) => b.id - a.id)[0];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented
          value={status}
          onChange={(v) => setParams(v ? { status: v } : {})}
          options={[
            { value: "", label: `Tất cả (${counts[""]})` },
            { value: "review", label: `Cần xem lại (${counts.review})` },
            { value: "graded", label: `Đã chấm (${counts.graded})` },
            { value: "error", label: `Lỗi (${counts.error})` },
          ]}
        />
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input className="pl-9" placeholder="SBD, họ tên, tên file…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {firstReview && (
          <Button className="ml-auto" variant="outline" icon={<PlayCircle className="h-4 w-4" />} onClick={() => nav(`/submissions/${firstReview.id}?queue=review`)}>
            Duyệt nhanh {counts.review} bài cần xem lại
          </Button>
        )}
      </div>

      <Card className="overflow-hidden">
        {!rows.length ? (
          <Empty icon={<ListChecks className="h-6 w-6" />} title={data?.length ? "Không có bài phù hợp" : "Chưa có bài làm"}
            description={data?.length ? undefined : "Vào tab Chấm bài để tải ảnh phiếu lên."}
            action={!data?.length && <Link to="../grade"><Button>Chấm bài</Button></Link>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-left text-[12px] text-slate-500 [&_th]:font-normal">
                <tr>
                  {th("id", "#")}
                  {th("sbd", "SBD")}
                  <th className="px-4 py-2.5">Thí sinh</th>
                  <th className="px-4 py-2.5">Mã đề</th>
                  <th className="px-4 py-2.5 text-right">Đúng</th>
                  {th("score", "Điểm", true)}
                  {th("confidence", "Tin cậy", true)}
                  <th className="px-4 py-2.5">Cảnh báo</th>
                  <th className="px-4 py-2.5">Trạng thái</th>
                  <th className="px-4 py-2.5">Thời gian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((s) => {
                  const kinds = [...new Set(s.flags.filter((f) => f.kind !== "warning").map((f) => f.kind))];
                  return (
                    <tr key={s.id} className="cursor-pointer hover:bg-slate-50" onClick={() => nav(`/submissions/${s.id}${status ? `?queue=${status}` : ""}`)}>
                      <td className="px-4 py-2.5 text-slate-400 tabular">{s.id}</td>
                      <td className="px-4 py-2.5 font-mono font-medium tabular text-slate-800">{s.sbd || "—"}</td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-slate-800">{s.student_name || <span className="text-slate-400">—</span>}</div>
                        <div className="max-w-[220px] truncate text-xs text-slate-400">{s.class_name || s.source_name}</div>
                      </td>
                      <td className="px-4 py-2.5 font-mono tabular">{s.exam_code || "—"}</td>
                      <td className="px-4 py-2.5 text-right tabular text-slate-600">{s.num_correct ?? "—"}/{exam.num_questions}</td>
                      <td className={`px-4 py-2.5 text-right text-base font-semibold tabular ${scoreColor(s.score, exam.max_score)}`}>{fmtScore(s.score)}</td>
                      <td className="px-4 py-2.5 text-right tabular text-slate-500">{s.status === "error" ? "—" : `${Math.round(s.confidence * 100)}%`}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex max-w-[260px] flex-wrap gap-1">
                          {s.status === "error" ? (
                            <span className="truncate text-xs text-rose-600" title={s.error}>{s.error}</span>
                          ) : (
                            kinds.map((k) => (
                              <Badge key={k} tone={k === "duplicate" || k === "unknown_code" || k === "unknown_student" ? "red" : "amber"}>
                                {FLAG_LABEL[k] ?? k} {s.flags.filter((f) => f.kind === k).length > 1 && `×${s.flags.filter((f) => f.kind === k).length}`}
                              </Badge>
                            ))
                          )}
                          {s.reviewed && <Badge tone="green">Đã duyệt</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-2.5"><StatusBadge status={s.status} /></td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">{timeAgo(s.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
