import { useQuery } from "@tanstack/react-query";
import { BarChart3, Info } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { Badge, Card, CardHeader, Empty, PageLoader, Select, StatCard, StatStrip } from "../../components/ui";
import { api } from "../../lib/api";
import type { ExamStats, ItemStat } from "../../lib/types";
import { cn, fmtPct, fmtScore } from "../../lib/utils";
import { useExam } from "./ExamLayout";

const OPT_COLORS = ["#5f5b50", "#8a8576", "#a39e91", "#77736a", "#b3ae9f", "#58554e"];

function OptionBar({ it, options }: { it: ItemStat; options: string[] }) {
  const total = options.reduce((s, o) => s + it.options[o], 0) + it.blank + it.multi || 1;
  return (
    <div className="flex h-5 w-full min-w-[160px] overflow-hidden rounded bg-slate-100">
      {options.map((o, i) => {
        const w = (it.options[o] / total) * 100;
        if (!w) return null;
        return (
          <div
            key={o}
            title={`${o}: ${it.options[o]}`}
            className={cn("flex items-center justify-center text-[10px] font-semibold text-white", o === it.key && "font-bold")}
            style={{ width: `${w}%`, background: o === it.key ? "#1e6b3a" : OPT_COLORS[i] }}
          >
            {w > 9 && o}
          </div>
        );
      })}
      {it.blank + it.multi > 0 && <div className="bg-slate-300" style={{ width: `${((it.blank + it.multi) / total) * 100}%` }} title={`Trống: ${it.blank}, tô nhiều: ${it.multi}`} />}
    </div>
  );
}

const diffTone = (p: number) => (p >= 0.7 ? "green" : p >= 0.3 ? "blue" : "red");
const discTone = (d: number | null) => (d === null ? "gray" : d >= 0.4 ? "green" : d >= 0.3 ? "blue" : d >= 0.2 ? "amber" : "red");

export default function Stats() {
  const exam = useExam();
  const [code, setCode] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["stats", exam.id, code],
    queryFn: () => api.get<ExamStats>(`/api/exams/${exam.id}/stats${code ? `?code=${code}` : ""}`),
  });
  if (isLoading || !data) return <PageLoader />;
  const o = data.overview;
  if (!o.scored)
    return (
      <Card>
        <Empty icon={<BarChart3 className="h-6 w-6" />} title="Chưa có dữ liệu thống kê" description="Cần có bài làm đã được tính điểm (đã có đáp án đúng mã đề)." />
      </Card>
    );
  const options = "ABCDEF".slice(0, exam.num_options).split("");
  const passLine = exam.pass_score;
  const bad = data.items.filter((i) => i.d !== null && i.d < 0.2);

  return (
    <div className="space-y-6">
      <StatStrip>
        <StatCard label="Số bài có điểm" value={o.scored} hint={o.roster ? `${o.absent} thí sinh chưa có bài` : undefined} />
        <StatCard label="Điểm trung bình" value={fmtScore(o.mean)} hint={`Trung vị ${fmtScore(o.median)} · độ lệch ${fmtScore(o.stdev)}`} />
        <StatCard label="Cao nhất / thấp nhất" value={`${fmtScore(o.max)} / ${fmtScore(o.min)}`} />
        <StatCard label="Tỉ lệ đạt" value={fmtPct(o.pass_rate, 1)} hint={`Điểm ≥ ${o.pass_score}`} />
        <StatCard label="Câu hỏi cần xem lại" value={bad.length} hint="Độ phân biệt < 0,2" tone={bad.length ? "amber" : undefined} />
      </StatStrip>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Phổ điểm" subtitle={`Số thí sinh theo khoảng điểm (thang ${o.max_score})`} />
          <div className="h-72 px-2 py-4">
            <ResponsiveContainer>
              <BarChart data={data.histogram} margin={{ left: -16, right: 12 }}>
                <CartesianGrid vertical={false} stroke="#eef2f7" />
                <XAxis dataKey="range" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: "#f1f5f9" }} formatter={(v: number) => [v, "Thí sinh"]} />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                  {data.histogram.map((h, i) => (
                    <Cell key={i} fill={h.from + o.max_score / 10 <= passLine ? "#c8401f" : "#24231f"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardHeader title="Điểm cao nhất" />
          <ol className="divide-y divide-slate-100">
            {data.top.slice(0, 7).map((t, i) => (
              <li key={t.submission_id}>
                <Link to={`/submissions/${t.submission_id}`} className="flex items-center gap-3 px-5 py-2 text-sm hover:bg-slate-50">
                  <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold", i < 3 ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500")}>{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-slate-800">{t.name || `SBD ${t.sbd}`}</span>
                    <span className="text-xs text-slate-400">{t.class_name || t.sbd}</span>
                  </span>
                  <span className="font-display text-[17px] tabular">{fmtScore(t.score)}</span>
                </Link>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Theo lớp" />
          <div className="h-64 px-2 py-4">
            <ResponsiveContainer>
              <BarChart data={data.by_class} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid horizontal={false} stroke="#eef2f7" />
                <XAxis type="number" domain={[0, o.max_score]} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v: number, n: string) => [n === "mean" ? fmtScore(v) : v, n === "mean" ? "Điểm TB" : n]} />
                <ReferenceLine x={passLine} stroke="#c8401f" strokeDasharray="4 4" />
                <Bar dataKey="mean" fill="#24231f" radius={[0, 3, 3, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardHeader
            title="Độ khó × độ phân biệt"
            subtitle="Mỗi điểm là một câu. Vùng xanh: câu hỏi tốt (0,3 ≤ p ≤ 0,8 và D ≥ 0,3)"
          />
          <div className="h-64 px-2 py-4">
            <ResponsiveContainer>
              <ScatterChart margin={{ left: -10, right: 16, top: 4 }}>
                <CartesianGrid stroke="#eef2f7" />
                <ReferenceArea x1={0.3} x2={0.8} y1={0.3} y2={1} fill="#1e6b3a" fillOpacity={0.07} />
                <XAxis type="number" dataKey="p" name="Tỉ lệ đúng" domain={[0, 1]} tick={{ fontSize: 12 }} tickFormatter={(v) => `${v * 100}%`} />
                <YAxis type="number" dataKey="d" name="Độ phân biệt" domain={[-0.5, 1]} tick={{ fontSize: 12 }} />
                <ZAxis range={[50, 50]} />
                <ReferenceLine y={0.2} stroke="#c08a14" strokeDasharray="4 4" />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  content={({ payload }) => {
                    const it = payload?.[0]?.payload as ItemStat | undefined;
                    if (!it) return null;
                    return (
                      <div className="rounded-lg bg-white px-3 py-2 text-xs shadow-pop ring-1 ring-slate-200">
                        <b>Câu {it.q}</b> (đáp án {it.key}) — đúng {fmtPct(it.p)}, D = {it.d}
                      </div>
                    );
                  }}
                />
                <Scatter data={data.items.filter((i) => i.d !== null)} fill="#24231f" fillOpacity={0.8} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Phân tích từng câu hỏi"
          subtitle={
            <span className="inline-flex items-center gap-1">
              <Info className="h-3.5 w-3.5" /> p = tỉ lệ làm đúng; D = độ phân biệt (nhóm 27% điểm cao − nhóm 27% điểm thấp, thang Ebel)
            </span>
          }
          actions={
            data.codes.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                Mã đề
                <Select className="w-28" value={data.item_code ?? ""} onChange={(e) => setCode(e.target.value)}>
                  {data.codes.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </div>
            )
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-[12px] text-slate-500 [&_th]:font-normal">
              <tr>
                <th className="px-4 py-2.5">Câu</th>
                <th className="px-4 py-2.5">Đáp án</th>
                <th className="px-4 py-2.5 text-right">Tỉ lệ đúng</th>
                <th className="px-4 py-2.5">Độ khó</th>
                <th className="px-4 py-2.5 text-right">D</th>
                <th className="px-4 py-2.5">Phân biệt</th>
                <th className="px-4 py-2.5">Phân bố lựa chọn</th>
                <th className="px-4 py-2.5">Nhiễu mạnh nhất</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.map((it) => (
                <tr key={it.q} className={cn(it.d !== null && it.d < 0.2 && "bg-amber-50/40")}>
                  <td className="px-4 py-2 font-semibold tabular">{it.q}</td>
                  <td className="px-4 py-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-emerald-600 font-mono text-xs font-medium text-emerald-700">{it.key || "?"}</span>
                  </td>
                  <td className="px-4 py-2 text-right tabular">{fmtPct(it.p)}</td>
                  <td className="px-4 py-2"><Badge tone={diffTone(it.p)}>{it.difficulty}</Badge></td>
                  <td className="px-4 py-2 text-right tabular">{it.d ?? "—"}</td>
                  <td className="px-4 py-2">{it.discrimination && <Badge tone={discTone(it.d)}>{it.discrimination}</Badge>}</td>
                  <td className="w-64 px-4 py-2"><OptionBar it={it} options={options} /></td>
                  <td className="px-4 py-2 text-slate-600">
                    {it.top_distractor && it.options[it.top_distractor] > 0 ? (
                      <>
                        {it.top_distractor} <span className="text-slate-400">({it.options[it.top_distractor]})</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
