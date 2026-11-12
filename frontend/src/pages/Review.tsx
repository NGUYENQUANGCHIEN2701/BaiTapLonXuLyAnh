import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  History,
  RotateCcw,
  Save,
  Trash2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Badge, Button, Card, CardHeader, Input, Kbd, Modal, PageLoader, Segmented, StatusBadge, useConfirm } from "../components/ui";
import { api, errMsg } from "../lib/api";
import type { Activity, Exam, OmrItem, Submission } from "../lib/types";
import { cn, FLAG_LABEL, fmtDate, fmtScore, scoreColor } from "../lib/utils";
import { useExamQuery } from "./exam/ExamLayout";
import { AnswerGrid } from "./exam/Keys";

type View = "interactive" | "annotated" | "original";

function SheetOverlay({
  sub,
  answers,
  sbd,
  code,
  focusQ,
  onToggle,
  onDigit,
}: {
  sub: Submission;
  answers: string[];
  sbd: string;
  code: string;
  focusQ: number | null;
  onToggle: (q: number, opt: string, multi: boolean) => void;
  onDigit: (block: "sbd" | "code", pos: number, digit: string) => void;
}) {
  const d = sub.omr_detail;
  const W = d.width ?? 1260;
  const H = d.height ?? 1782;
  const items = d.items ?? [];
  const key = sub.key;
  const [hover, setHover] = useState<{ x: number; y: number; text: string } | null>(null);
  let qi = -1;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full select-none">
        <image href={`/api/submissions/${sub.id}/image/warped?v=${sub.id}`} width={W} height={H} />
        {items.map((it: OmrItem) => {
          if (it.block === "sbd" || it.block === "code") {
            const value = it.block === "sbd" ? sbd : code;
            const pos = Number(it.key.replace(/\D/g, "")) - 1;
            return it.centers.map(([x, y], i) => {
              const on = value[pos] === it.labels[i];
              return (
                <circle
                  key={`${it.key}-${i}`}
                  cx={x}
                  cy={y}
                  r={it.radius + 1}
                  className="cursor-pointer"
                  fill={on ? "color-mix(in srgb, var(--color-primary) 42%, transparent)" : "transparent"}
                  stroke={on ? "var(--color-primary-hover)" : "transparent"}
                  strokeWidth={2}
                  onClick={() => onDigit(it.block as "sbd" | "code", pos, it.labels[i])}
                  onMouseEnter={() => setHover({ x, y, text: `${it.block === "sbd" ? "SBD" : "Mã đề"} vị trí ${pos + 1} = ${it.labels[i]} · độ sáng ${it.values[i]}` })}
                  onMouseLeave={() => setHover(null)}
                />
              );
            });
          }
          qi++;
          const q = qi;
          const a = answers[q] ?? "";
          const k = key?.[q] ?? "";
          const flagged = it.uncertain || a.length > 1;
          const xs = it.centers.map((c) => c[0]);
          return (
            <g key={it.key}>
              {(flagged || focusQ === q) && (
                <rect
                  x={Math.min(...xs) - it.radius * 2.8}
                  y={it.centers[0][1] - it.radius * 1.5}
                  width={Math.max(...xs) - Math.min(...xs) + it.radius * 4.4}
                  height={it.radius * 3}
                  rx={6}
                  fill={focusQ === q ? "color-mix(in srgb, var(--color-primary) 12%, transparent)" : "color-mix(in srgb, var(--color-warning) 15%, transparent)"}
                  stroke={focusQ === q ? "var(--color-primary)" : "var(--color-warning)"}
                  strokeWidth={2}
                  strokeDasharray={focusQ === q ? undefined : "6 4"}
                />
              )}
              {it.centers.map(([x, y], i) => {
                const opt = it.labels[i];
                const chosen = a.includes(opt);
                const isKey = k.includes(opt);
                const fill = chosen ? (key ? (a === k ? "color-mix(in srgb, var(--color-success) 50%, transparent)" : "color-mix(in srgb, var(--color-danger) 50%, transparent)") : "color-mix(in srgb, var(--color-primary) 45%, transparent)") : "transparent";
                return (
                  <g key={i}>
                    {isKey && !chosen && <circle cx={x} cy={y} r={it.radius + 2.5} fill="none" stroke="var(--color-success)" strokeWidth={3} />}
                    <circle
                      cx={x}
                      cy={y}
                      r={it.radius + 1}
                      fill={fill}
                      stroke={chosen ? (key ? (a === k ? "var(--color-success)" : "var(--color-danger)") : "var(--color-navy)") : "transparent"}
                      strokeWidth={2}
                      className="cursor-pointer hover:stroke-slate-900"
                      onClick={(e) => onToggle(q, opt, e.shiftKey || e.ctrlKey)}
                      onMouseEnter={() => setHover({ x, y, text: `Câu ${q + 1}${opt} · độ sáng ${it.values[i]} · ngưỡng ${it.threshold}${it.marked[i] ? " · máy đọc: tô" : ""}` })}
                      onMouseLeave={() => setHover(null)}
                    />
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
      {hover && (
        <div
          className="pointer-events-none absolute z-10 max-w-64 -translate-x-1/2 -translate-y-full rounded-lg bg-navy px-3 py-2 text-[13px] text-white shadow-sm"
          style={{ left: `${(hover.x / W) * 100}%`, top: `calc(${(hover.y / H) * 100}% - 14px)` }}
        >
          {hover.text}
        </div>
      )}
    </div>
  );
}

function HistoryModal({ subId, open, onClose }: { subId: number; open: boolean; onClose: () => void }) {
  const { data } = useQuery({ queryKey: ["history", subId], queryFn: () => api.get<Activity[]>(`/api/submissions/${subId}/history`), enabled: open });
  const label: Record<string, string> = { upload: "Tải lên & chấm tự động", edit: "Chỉnh sửa", reset: "Khôi phục kết quả máy" };
  return (
    <Modal open={open} onClose={onClose} title="Lịch sử chỉnh sửa" size="lg">
      <ol className="space-y-4">
        {data?.map((a) => (
          <li key={a.id} className="border-l border-slate-300 pl-4">
            <div className="text-[15px]">
              <b>{a.user || "Hệ thống"}</b> · {label[a.action] ?? a.action} <span className="text-text-muted">· {fmtDate(a.created_at)}</span>
            </div>
            {a.action === "edit" && (
              <ul className="mt-1 space-y-0.5 text-[13px] text-slate-600">
                {"sbd" in a.detail && <li>SBD: {(a.detail.sbd as string[])[0]} → <b>{(a.detail.sbd as string[])[1]}</b></li>}
                {"exam_code" in a.detail && <li>Mã đề: {(a.detail.exam_code as string[])[0]} → <b>{(a.detail.exam_code as string[])[1]}</b></li>}
                {"answers" in a.detail &&
                  Object.entries(a.detail.answers as Record<string, string[]>).map(([q, [o, n]]) => (
                    <li key={q}>Câu {q}: {o || "∅"} → <b>{n || "∅"}</b></li>
                  ))}
                {"reviewed" in a.detail && <li>{a.detail.reviewed ? "Đánh dấu đã duyệt" : "Bỏ đánh dấu duyệt"}</li>}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </Modal>
  );
}

function ReviewBody({ sub, exam }: { sub: Submission; exam: Exam }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const confirm = useConfirm();
  const [params] = useSearchParams();
  const queue = params.get("queue") ?? "";
  const [view, setView] = useState<View>(sub.has_images.warped ? "interactive" : "original");
  const [zoom, setZoom] = useState(1);
  const [answers, setAnswers] = useState<string[]>(sub.answers);
  const [sbd, setSbd] = useState(sub.sbd);
  const [code, setCode] = useState(sub.exam_code);
  const [focusQ, setFocusQ] = useState<number | null>(null);
  const [histOpen, setHistOpen] = useState(false);

  useEffect(() => {
    setAnswers(sub.answers);
    setSbd(sub.sbd);
    setCode(sub.exam_code);
    setFocusQ(null);
  }, [sub]);

  const { data: nb } = useQuery({
    queryKey: ["neighbors", sub.id, queue],
    queryFn: () => api.get<{ prev: number | null; next: number | null; review_remaining: number }>(`/api/submissions/${sub.id}/neighbors${queue ? `?status=${queue}` : ""}`),
  });

  const dirty = sbd !== sub.sbd || code !== sub.exam_code || answers.some((a, i) => a !== sub.answers[i]);
  const liveCorrect = sub.key ? answers.filter((a, i) => a && a === sub.key![i]).length : null;
  const liveScore = liveCorrect !== null ? (exam.max_score * liveCorrect) / exam.num_questions : null;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["submissions", exam.id] });
    qc.invalidateQueries({ queryKey: ["exam", exam.id] });
    qc.invalidateQueries({ queryKey: ["exams"] });
    qc.invalidateQueries({ queryKey: ["stats", exam.id] });
    qc.invalidateQueries({ queryKey: ["history", sub.id] });
  };

  const save = useMutation({
    mutationFn: (reviewed?: boolean) => api.patch<Submission>(`/api/submissions/${sub.id}`, { sbd, exam_code: code, answers, ...(reviewed !== undefined ? { reviewed } : {}) }),
    onSuccess: (s, reviewed) => {
      qc.setQueryData(["submission", sub.id], s);
      invalidate();
      if (reviewed) {
        // sau khi duyệt: chuyển sang bài kế tiếp trong hàng đợi
        api.get<{ next: number | null; prev: number | null }>(`/api/submissions/${sub.id}/neighbors?status=review`).then((n) => {
          const target = n.next ?? n.prev;
          toast.success(target ? "Đã duyệt — chuyển bài tiếp theo" : "Đã duyệt xong tất cả bài cần xem lại");
          if (target && target !== sub.id) nav(`/submissions/${target}?queue=review`);
        });
      } else toast.success("Đã lưu");
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const reset = async () => {
    if (!(await confirm({ title: "Khôi phục kết quả máy đọc?", message: "Mọi chỉnh sửa tay trên bài này sẽ bị hủy." }))) return;
    const s = await api.post<Submission>(`/api/submissions/${sub.id}/reset`);
    qc.setQueryData(["submission", sub.id], s);
    invalidate();
  };

  const remove = async () => {
    if (!(await confirm({ title: "Xóa bài làm này?", message: "Ảnh và kết quả chấm sẽ bị xóa.", danger: true, confirmText: "Xóa" }))) return;
    await api.del(`/api/submissions/${sub.id}`);
    invalidate();
    toast.success("Đã xóa bài làm");
    const target = nb?.next ?? nb?.prev;
    nav(target ? `/submissions/${target}${queue ? `?queue=${queue}` : ""}` : `/exams/${exam.id}/results`);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        save.mutate(undefined);
      } else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        save.mutate(true);
      } else if (e.altKey && e.key === "ArrowRight" && nb?.next) nav(`/submissions/${nb.next}${queue ? `?queue=${queue}` : ""}`);
      else if (e.altKey && e.key === "ArrowLeft" && nb?.prev) nav(`/submissions/${nb.prev}${queue ? `?queue=${queue}` : ""}`);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save, nb, nav, queue]);

  const toggle = (q: number, opt: string, multi: boolean) => {
    setFocusQ(q);
    setAnswers((prev) => {
      const next = [...prev];
      const cur = next[q] ?? "";
      next[q] = multi ? (cur.includes(opt) ? cur.replace(opt, "") : [...(cur + opt)].sort().join("")) : cur === opt ? "" : opt;
      return next;
    });
  };
  const setDigit = (block: "sbd" | "code", pos: number, digit: string) => {
    const len = block === "sbd" ? 6 : 3;
    const cur = (block === "sbd" ? sbd : code).padEnd(len, "?").split("");
    cur[pos] = digit;
    (block === "sbd" ? setSbd : setCode)(cur.join(""));
  };

  const flags = sub.flags.filter((f) => f.kind !== "warning");
  const warnings = sub.flags.filter((f) => f.kind === "warning");
  const changed = useMemo(() => answers.map((a, i) => a !== sub.omr_answers[i]).filter(Boolean).length, [answers, sub.omr_answers]);

  return (
    <div className="animate-fade-in">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link to={`/exams/${exam.id}/results${queue ? `?status=${queue}` : ""}`} className="inline-flex items-center gap-1 text-[15px] text-slate-500 hover:text-slate-800">
          <ChevronLeft className="h-4 w-4" /> {exam.name}
        </Link>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {queue === "review" && nb && <Badge tone="amber">Còn {nb.review_remaining} bài cần xem lại</Badge>}
          <Button variant="secondary" size="sm" disabled={!nb?.prev} onClick={() => nav(`/submissions/${nb!.prev}${queue ? `?queue=${queue}` : ""}`)} icon={<ChevronLeft className="h-4 w-4" />}>
            Trước
          </Button>
          <Button variant="secondary" size="sm" disabled={!nb?.next} onClick={() => nav(`/submissions/${nb!.next}${queue ? `?queue=${queue}` : ""}`)}>
            Sau <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2.5">
            <Segmented
              value={view}
              onChange={setView}
              options={[
                ...(sub.has_images.warped ? [{ value: "interactive" as View, label: "Tương tác" }, { value: "annotated" as View, label: "Ảnh chấm" }] : []),
                { value: "original" as View, label: "Ảnh gốc" },
              ]}
            />
            <div className="ml-auto flex items-center gap-1">
              <Button variant="ghost" size="icon" aria-label="Thu nhỏ ảnh" onClick={() => setZoom((z) => Math.max(1, z - 0.5))} disabled={zoom <= 1}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="w-12 text-center text-[13px] tabular text-slate-500">{Math.round(zoom * 100)}%</span>
              <Button variant="ghost" size="icon" aria-label="Phóng to ảnh" onClick={() => setZoom((z) => Math.min(3, z + 0.5))} disabled={zoom >= 3}>
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="max-h-[calc(100vh-190px)] overflow-auto bg-slate-100 p-3">
            <div style={{ width: `${zoom * 100}%` }} className="mx-auto max-w-none rounded bg-white shadow">
              {view === "interactive" ? (
                <SheetOverlay sub={sub} answers={answers} sbd={sbd} code={code} focusQ={focusQ} onToggle={toggle} onDigit={setDigit} />
              ) : (
                <img
                  src={`/api/submissions/${sub.id}/image/${view}?v=${encodeURIComponent(sub.updated_at ?? "")}`}
                  className="block h-auto w-full"
                  alt="Ảnh bài làm"
                />
              )}
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <div className="flex items-start gap-4 p-5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={sub.status} />
                  {sub.reviewed && <Badge tone="green"><CheckCircle2 className="h-3 w-3" /> Đã duyệt</Badge>}
                  <span className="text-[13px] text-text-muted">#{sub.id}</span>
                </div>
                <h2 className="mt-2 truncate text-lg font-semibold text-slate-900">{sub.student_name || "Không rõ thí sinh"}</h2>
                <p className="text-[15px] text-slate-500">{sub.class_name || sub.source_name}</p>
              </div>
              <div className="text-right">
                <div className={cn("font-sans text-[46px] leading-none tabular", scoreColor(dirty ? liveScore : sub.score, exam.max_score))}>{fmtScore(dirty ? liveScore : sub.score)}</div>
                <div className="text-[13px] text-slate-500">
                  {(dirty ? liveCorrect : sub.num_correct) ?? "—"}/{exam.num_questions} câu đúng
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-border px-5 py-4">
              <label className="block">
                <span className="mb-1 block text-[13px] font-medium text-slate-500">Số báo danh {sbd !== sub.omr_sbd && <span className="text-text">(máy đọc: {sub.omr_sbd})</span>}</span>
                <Input className="font-sans text-base tracking-widest" value={sbd} maxLength={6} onChange={(e) => setSbd(e.target.value.replace(/[^\d?*]/g, ""))} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[13px] font-medium text-slate-500">Mã đề {code !== sub.omr_exam_code && <span className="text-text">(máy: {sub.omr_exam_code})</span>}</span>
                <Input className="font-sans text-base tracking-widest" value={code} maxLength={3} onChange={(e) => setCode(e.target.value.replace(/[^\d?*]/g, ""))} />
              </label>
            </div>
            <div className="flex flex-wrap gap-2 border-t border-border bg-slate-50/60 px-5 py-3">
              <Button variant="success" icon={<CheckCircle2 className="h-4 w-4" />} loading={save.isPending && save.variables === true} onClick={() => save.mutate(true)}>
                Duyệt{nb?.review_remaining ? " & tiếp" : ""}
              </Button>
              <Button variant="secondary" icon={<Save className="h-4 w-4" />} disabled={!dirty} loading={save.isPending && save.variables === undefined} onClick={() => save.mutate(undefined)}>
                Lưu
              </Button>
              <div className="ml-auto flex gap-1">
                <Button variant="ghost" size="icon" title="Lịch sử" onClick={() => setHistOpen(true)}><History className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" title="Khôi phục kết quả máy" onClick={reset}><RotateCcw className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" title="Xóa" className="hover:bg-rose-50 hover:text-rose-600" onClick={remove}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          </Card>

          {(flags.length > 0 || warnings.length > 0 || sub.error) && (
            <Card>
              <CardHeader title={`Cần chú ý (${flags.length})`} />
              <ul className="max-h-56 divide-y divide-border overflow-y-auto">
                {sub.error && <li className="px-5 py-2 text-[15px] text-rose-600">{sub.error}</li>}
                {[...flags, ...warnings].map((f, i) => {
                  const q = f.field.startsWith("q") ? Number(f.field.slice(1)) - 1 : null;
                  return (
                    <li key={i}>
                      <button
                        className="flex w-full items-center gap-2 px-5 py-2 text-left text-[15px] hover:bg-primary-softer"
                        onClick={() => {
                          if (q !== null) {
                            setFocusQ(q);
                            setView("interactive");
                          }
                        }}
                      >
                        <Badge tone={f.kind === "warning" ? "gray" : ["duplicate", "unknown_code", "unknown_student", "mismatch"].includes(f.kind) ? "red" : "amber"}>
                          {FLAG_LABEL[f.kind] ?? f.kind}
                        </Badge>
                        <span className="text-slate-700">{f.message}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          <Card>
            <CardHeader
              title="Bài làm"
              subtitle={
                <span>
                  {sub.key ? "Xanh = đúng, đỏ = sai, viền xanh = đáp án đúng" : "Chưa có đáp án cho mã đề này"}
                  {changed > 0 && <> · <b className="text-text">{changed} câu đã sửa tay</b></>}
                </span>
              }
            />
            <div className="overflow-x-auto p-4">
              <AnswerGrid exam={exam} value={answers} onChange={setAnswers} compare={sub.key} />
            </div>
          </Card>

          <Card className="p-4 text-[13px] text-slate-500">
            <div className="grid grid-cols-2 gap-y-1">
              <span>Căn chỉnh</span>
              <span className="text-right text-slate-700">{sub.align_method || "—"} · xoay {sub.rotation}°</span>
              <span>Ngưỡng toàn cục</span>
              <span className="text-right text-slate-700">{sub.omr_detail.global_threshold ?? "—"} (bước nhảy {sub.omr_detail.global_jump ?? "—"})</span>
              <span>Độ khớp hình mẫu</span>
              <span className="text-right text-slate-700">{sub.omr_detail.verify_score ?? "—"}</span>
              <span>Độ tin cậy</span>
              <span className="text-right text-slate-700">{Math.round(sub.confidence * 100)}%</span>
              <span>Thời gian xử lý</span>
              <span className="text-right text-slate-700">{Math.round(sub.elapsed_ms)} ms</span>
              <span>Tải lên</span>
              <span className="text-right text-slate-700">{fmtDate(sub.created_at)}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-border pt-3">
              <span><Kbd>Ctrl</Kbd>+<Kbd>S</Kbd> lưu</span>
              <span><Kbd>Ctrl</Kbd>+<Kbd>Enter</Kbd> duyệt</span>
              <span><Kbd>Alt</Kbd>+<Kbd>←/→</Kbd> bài trước/sau</span>
              <span><Kbd>Shift</Kbd>+click chọn nhiều</span>
            </div>
          </Card>
        </div>
      </div>
      <HistoryModal subId={sub.id} open={histOpen} onClose={() => setHistOpen(false)} />
    </div>
  );
}

export default function Review() {
  const id = Number(useParams().subId);
  const { data: sub, isLoading } = useQuery({ queryKey: ["submission", id], queryFn: () => api.get<Submission>(`/api/submissions/${id}`) });
  const { data: exam } = useExamQuery(sub?.exam_id ?? 0, !!sub);
  if (isLoading || !sub || !exam) return <PageLoader />;
  return <ReviewBody key={sub.id} sub={sub} exam={exam} />;
}
