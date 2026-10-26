import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, ClipboardPaste, FileSpreadsheet, KeyRound, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge, Button, Card, CardHeader, Dropzone, Empty, Field, Input, Modal, PageLoader, Textarea, useConfirm } from "../../components/ui";
import { api, errMsg, upload } from "../../lib/api";
import type { AnswerKey, Exam } from "../../lib/types";
import { cn, downloadUrl } from "../../lib/utils";
import { useExam } from "./ExamLayout";

export function AnswerGrid({
  exam,
  value,
  onChange,
  compare,
  readOnly,
}: {
  exam: Exam;
  value: string[];
  onChange?: (v: string[]) => void;
  compare?: string[] | null; // đáp án đúng (để tô màu khi xem bài làm)
  readOnly?: boolean;
}) {
  const opts = "ABCDEF".slice(0, exam.num_options).split("");
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const perCol = 10;
  const cols = Math.ceil(exam.num_questions / perCol);
  const set = (q: number, o: string, toggle = false) => {
    if (readOnly || !onChange) return;
    const next = [...value];
    const cur = next[q] ?? "";
    next[q] = toggle ? (cur.includes(o) ? cur.replace(o, "") : [...cur + o].sort().join("")) : cur === o ? "" : o;
    onChange(next);
  };
  return (
    <div className="grid gap-x-6 gap-y-1" style={{ gridTemplateColumns: `repeat(${Math.min(cols, 4)}, minmax(0, 1fr))` }}>
      {Array.from({ length: cols }).map((_, c) => (
        <div key={c} className="space-y-0.5">
          {Array.from({ length: perCol }).map((_, r) => {
            const q = c * perCol + r;
            if (q >= exam.num_questions) return null;
            const a = value[q] ?? "";
            const k = compare?.[q];
            const wrong = compare && a !== (k ?? "");
            return (
              <div
                key={q}
                ref={(el) => {
                  refs.current[q] = el;
                }}
                tabIndex={readOnly ? -1 : 0}
                onKeyDown={(e) => {
                  const key = e.key.toUpperCase();
                  if (opts.includes(key)) {
                    set(q, key, e.shiftKey);
                    if (!e.shiftKey) refs.current[q + 1]?.focus();
                    e.preventDefault();
                  } else if (e.key === "Backspace" || e.key === "Delete" || e.key === " ") {
                    onChange?.(value.map((v, i) => (i === q ? "" : v)));
                    e.preventDefault();
                  } else if (e.key === "ArrowDown") {
                    refs.current[q + 1]?.focus();
                    e.preventDefault();
                  } else if (e.key === "ArrowUp") {
                    refs.current[q - 1]?.focus();
                    e.preventDefault();
                  }
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-1.5 py-0.5 outline-none focus:bg-brand-50 focus:ring-1 focus:ring-brand-300",
                  wrong && "bg-rose-50",
                )}
              >
                <span className="w-7 text-right text-xs font-semibold text-slate-500 tabular">{q + 1}</span>
                {opts.map((o) => {
                  const on = a.includes(o);
                  const isKey = k?.includes(o);
                  return (
                    <button
                      key={o}
                      type="button"
                      tabIndex={-1}
                      disabled={readOnly}
                      onClick={(e) => set(q, o, e.shiftKey || e.ctrlKey)}
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ring-1 transition-colors",
                        on
                          ? compare
                            ? a === k
                              ? "bg-emerald-600 text-white ring-emerald-600"
                              : "bg-rose-600 text-white ring-rose-600"
                            : "bg-slate-800 text-white ring-slate-800"
                          : isKey && compare
                            ? "bg-white text-emerald-700 ring-2 ring-emerald-500"
                            : "bg-white text-slate-400 ring-slate-300 hover:ring-slate-500",
                        !readOnly && "cursor-pointer",
                      )}
                    >
                      {o}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function KeyEditor({ exam, initial, onDone }: { exam: Exam; initial?: AnswerKey | { code: string; answers: string[] }; onDone: () => void }) {
  const qc = useQueryClient();
  const [code, setCode] = useState(initial?.code ?? "");
  const [answers, setAnswers] = useState<string[]>(() => (initial?.answers ?? []).concat(Array(exam.num_questions).fill("")).slice(0, exam.num_questions));
  const [pasteOpen, setPasteOpen] = useState(false);
  const [paste, setPaste] = useState("");
  useEffect(() => {
    setCode(initial?.code ?? "");
    setAnswers((initial?.answers ?? []).concat(Array(exam.num_questions).fill("")).slice(0, exam.num_questions));
  }, [initial, exam.num_questions]);
  const filled = answers.filter(Boolean).length;
  const save = useMutation({
    mutationFn: () => api.post<AnswerKey>(`/api/exams/${exam.id}/keys`, { code, answers }),
    onSuccess: () => {
      toast.success(`Đã lưu đáp án mã đề ${code.padStart(3, "0")}`);
      qc.invalidateQueries({ queryKey: ["keys", exam.id] });
      qc.invalidateQueries({ queryKey: ["exam", exam.id] });
      qc.invalidateQueries({ queryKey: ["submissions", exam.id] });
      onDone();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <Card>
      <CardHeader
        title={initial && "id" in initial ? `Mã đề ${initial.code}` : "Mã đề mới"}
        subtitle={
          <span>
            Đã nhập {filled}/{exam.num_questions} câu · Bấm phím <b>A–{"ABCDEF"[exam.num_options - 1]}</b> để chọn và chuyển câu, mũi tên để di chuyển
          </span>
        }
        actions={
          <>
            <Button variant="ghost" size="sm" icon={<ClipboardPaste className="h-4 w-4" />} onClick={() => setPasteOpen(true)}>
              Dán chuỗi
            </Button>
            <Button size="sm" icon={<Save className="h-4 w-4" />} loading={save.isPending} disabled={!/^\d{1,3}$/.test(code)} onClick={() => save.mutate()}>
              Lưu đáp án
            </Button>
          </>
        }
      />
      <div className="p-5">
        <Field label="Mã đề (1–3 chữ số)" className="mb-5 max-w-[200px]">
          <Input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="101" disabled={!!initial && "id" in initial} />
        </Field>
        <AnswerGrid exam={exam} value={answers} onChange={setAnswers} />
      </div>
      <Modal
        open={pasteOpen}
        onClose={() => setPasteOpen(false)}
        title="Dán chuỗi đáp án"
        description="Ví dụ: ABCDABCD… hoặc 1A 2B 3C… (bỏ qua khoảng trắng, dấu phẩy, số thứ tự)"
        footer={
          <Button
            onClick={() => {
              const letters = paste.toUpperCase().replace(/\d+\s*[.:)-]?\s*/g, " ").match(/[A-F-]/g) ?? [];
              setAnswers((letters.map((l) => (l === "-" ? "" : l)) as string[]).concat(Array(exam.num_questions).fill("")).slice(0, exam.num_questions));
              setPasteOpen(false);
            }}
          >
            Áp dụng
          </Button>
        }
      >
        <Textarea rows={5} value={paste} onChange={(e) => setPaste(e.target.value)} className="font-mono" autoFocus />
      </Modal>
    </Card>
  );
}

export default function Keys() {
  const exam = useExam();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { data: keys, isLoading } = useQuery({ queryKey: ["keys", exam.id], queryFn: () => api.get<AnswerKey[]>(`/api/exams/${exam.id}/keys`) });
  const [selected, setSelected] = useState<AnswerKey | { code: string; answers: string[] } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [sheetBusy, setSheetBusy] = useState(false);

  useEffect(() => {
    if (keys && selected && "id" in selected) {
      const fresh = keys.find((k) => k.id === selected.id);
      if (fresh && fresh !== selected) setSelected(fresh);
    }
  }, [keys, selected]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["keys", exam.id] });
    qc.invalidateQueries({ queryKey: ["exam", exam.id] });
  };

  const importFile = async (files: File[]) => {
    const fd = new FormData();
    fd.append("file", files[0]);
    try {
      const r = await upload<{ imported: number; codes: string[]; errors: string[] }>(`/api/exams/${exam.id}/keys/import`, fd);
      toast.success(`Đã nhập ${r.imported} mã đề: ${r.codes.join(", ")}`);
      r.errors.slice(0, 3).forEach((m) => toast.warning(m));
      setImportOpen(false);
      refresh();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const fromSheet = async (files: File[]) => {
    const fd = new FormData();
    fd.append("file", files[0]);
    setSheetBusy(true);
    try {
      const r = await upload<{ code: string; answers: string[]; warnings: string[] }>(`/api/exams/${exam.id}/keys/from-sheet`, fd);
      setSelected({ code: r.code, answers: r.answers });
      toast.success(`Đã đọc phiếu đáp án mã đề ${r.code} — kiểm tra rồi bấm Lưu`);
      r.warnings.slice(0, 3).forEach((m) => toast.warning(m));
      setImportOpen(false);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSheetBusy(false);
    }
  };

  const remove = async (k: AnswerKey) => {
    if (!(await confirm({ title: `Xóa mã đề ${k.code}?`, message: "Các bài làm dùng mã đề này sẽ không còn điểm.", danger: true, confirmText: "Xóa" }))) return;
    await api.del(`/api/exams/${exam.id}/keys/${k.id}`);
    if (selected && "id" in selected && selected.id === k.id) setSelected(null);
    refresh();
  };

  if (isLoading) return <PageLoader />;

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <div className="space-y-4">
        <Card>
          <CardHeader title="Mã đề" subtitle={`${keys?.length ?? 0} mã đề`} />
          <ul className="divide-y divide-slate-100">
            {keys?.map((k) => {
              const n = k.answers.filter(Boolean).length;
              const active = selected && "id" in selected && selected.id === k.id;
              return (
                <li key={k.id} className={cn("group flex items-center gap-3 px-4 py-2.5", active ? "bg-brand-50" : "hover:bg-slate-50")}>
                  <button className="flex flex-1 items-center gap-3 text-left" onClick={() => setSelected(k)}>
                    <span className="flex h-9 w-12 items-center justify-center rounded-md bg-slate-800 font-mono text-sm font-semibold text-white">{k.code}</span>
                    <span className="text-sm">
                      <span className="block font-medium text-slate-800">Mã đề {k.code}</span>
                      <span className={cn("text-xs", n < exam.num_questions ? "text-amber-600" : "text-slate-500")}>
                        {n}/{exam.num_questions} câu
                      </span>
                    </span>
                  </button>
                  <button onClick={() => remove(k)} className="rounded p-1 text-slate-300 opacity-0 hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100" title="Xóa">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="space-y-2 border-t border-slate-100 p-3">
            <Button className="w-full" icon={<Plus className="h-4 w-4" />} onClick={() => setSelected({ code: "", answers: [] })}>
              Thêm mã đề
            </Button>
            <Button variant="secondary" className="w-full" icon={<FileSpreadsheet className="h-4 w-4" />} onClick={() => setImportOpen(true)}>
              Nhập từ Excel / ảnh phiếu
            </Button>
          </div>
        </Card>
      </div>

      <div>
        {selected ? (
          <KeyEditor exam={exam} initial={selected} onDone={() => undefined} />
        ) : (
          <Card>
            <Empty
              icon={<KeyRound className="h-6 w-6" />}
              title={keys?.length ? "Chọn một mã đề để xem / sửa" : "Chưa có đáp án"}
              description="Mỗi mã đề có một bộ đáp án riêng. Hệ thống đọc mã đề thí sinh tô trên phiếu để tra đúng đáp án."
              action={
                <div className="flex gap-2">
                  <Button icon={<Plus className="h-4 w-4" />} onClick={() => setSelected({ code: "", answers: [] })}>Nhập tay</Button>
                  <Button variant="secondary" icon={<Camera className="h-4 w-4" />} onClick={() => setImportOpen(true)}>Từ ảnh phiếu</Button>
                </div>
              }
            />
          </Card>
        )}
      </div>

      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Nhập đáp án" size="lg">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold"><FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Từ file Excel / CSV</h4>
            <Dropzone accept=".xlsx,.csv" multiple={false} onFiles={importFile} className="p-6 text-center">
              <p className="text-sm text-slate-600">Kéo thả hoặc bấm để chọn file</p>
              <p className="mt-1 text-xs text-slate-400">Cột “Câu” + mỗi cột một mã đề</p>
            </Dropzone>
            <button className="mt-2 text-xs font-medium text-brand-700 hover:underline" onClick={() => downloadUrl(`/api/exams/${exam.id}/keys/template.xlsx`)}>
              Tải file mẫu
            </button>
          </div>
          <div>
            <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Camera className="h-4 w-4 text-brand-600" /> Từ ảnh phiếu đáp án</h4>
            <Dropzone accept="image/*,.pdf" multiple={false} onFiles={fromSheet} className="p-6 text-center">
              {sheetBusy ? <p className="text-sm text-slate-600">Đang đọc phiếu…</p> : <p className="text-sm text-slate-600">Tô đáp án + mã đề lên phiếu trắng, rồi chụp ảnh</p>}
              <p className="mt-1 text-xs text-slate-400">JPG, PNG hoặc PDF</p>
            </Dropzone>
            <Badge tone="blue" className="mt-2">Dùng chính bộ xử lý ảnh OMR</Badge>
          </div>
        </div>
      </Modal>
    </div>
  );
}
