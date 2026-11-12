import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button, Card, Dropzone, Empty, Field, Input, Modal, PageLoader, StatusBadge, useConfirm } from "../../components/ui";
import { api, errMsg, upload } from "../../lib/api";
import type { Student } from "../../lib/types";
import { downloadUrl, fmtScore, scoreColor } from "../../lib/utils";
import { useExam } from "./ExamLayout";

type Form = Pick<Student, "sbd" | "full_name" | "dob" | "class_name" | "room">;
const EMPTY: Form = { sbd: "", full_name: "", dob: "", class_name: "", room: "" };

export default function Students() {
  const exam = useExam();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [q, setQ] = useState("");
  const [cls, setCls] = useState("");
  const [editing, setEditing] = useState<Student | "new" | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [importOpen, setImportOpen] = useState(false);
  const [replace, setReplace] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ["students", exam.id], queryFn: () => api.get<Student[]>(`/api/exams/${exam.id}/students`) });

  useEffect(() => {
    if (editing === "new") setForm(EMPTY);
    else if (editing) setForm(editing);
  }, [editing]);

  const classes = useMemo(() => [...new Set((data ?? []).map((s) => s.class_name).filter(Boolean))].sort(), [data]);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data ?? []).filter((st) => (!cls || st.class_name === cls) && (!s || st.sbd.includes(s) || st.full_name.toLowerCase().includes(s)));
  }, [data, q, cls]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["students", exam.id] });
    qc.invalidateQueries({ queryKey: ["exam", exam.id] });
    qc.invalidateQueries({ queryKey: ["submissions", exam.id] });
  };

  const save = useMutation({
    mutationFn: () =>
      editing === "new" ? api.post(`/api/exams/${exam.id}/students`, form) : api.put(`/api/exams/${exam.id}/students/${(editing as Student).id}`, form),
    onSuccess: () => {
      toast.success("Đã lưu thí sinh");
      setEditing(null);
      refresh();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const remove = async (s: Student) => {
    if (!(await confirm({ title: `Xóa thí sinh ${s.full_name}?`, danger: true, confirmText: "Xóa" }))) return;
    await api.del(`/api/exams/${exam.id}/students/${s.id}`);
    refresh();
  };

  const importFile = async (files: File[]) => {
    const fd = new FormData();
    fd.append("file", files[0]);
    try {
      const r = await upload<{ created: number; updated: number; errors: string[] }>(`/api/exams/${exam.id}/students/import?replace=${replace}`, fd);
      toast.success(`Thêm ${r.created}, cập nhật ${r.updated} thí sinh`);
      r.errors.slice(0, 4).forEach((m) => toast.warning(m));
      setImportOpen(false);
      refresh();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  if (isLoading) return <PageLoader />;
  const submitted = (data ?? []).filter((s) => s.submission_id).length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <Input className="pl-9" placeholder="Tìm SBD hoặc họ tên…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {classes.length > 1 && (
          <select className="h-9 rounded-lg border-0 bg-white px-3 text-[15px] shadow-sm ring-1 ring-slate-300" value={cls} onChange={(e) => setCls(e.target.value)}>
            <option value="">Tất cả lớp</option>
            {classes.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        )}
        <span className="text-[15px] text-slate-500">
          {data?.length ?? 0} thí sinh · {submitted} đã có bài
        </span>
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" icon={<FileSpreadsheet className="h-4 w-4" />} onClick={() => setImportOpen(true)}>
            Nhập Excel
          </Button>
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing("new")}>
            Thêm thí sinh
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        {!data?.length ? (
          <Empty
            icon={<Users className="h-6 w-6" />}
            title="Chưa có danh sách thí sinh"
            description="Không bắt buộc, nhưng có danh sách thì hệ thống tự ghép họ tên theo SBD, phát hiện SBD tô sai và in được phiếu cá nhân hóa."
            action={<Button variant="secondary" icon={<FileSpreadsheet className="h-4 w-4" />} onClick={() => setImportOpen(true)}>Nhập từ Excel</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[15px]">
              <thead className="border-b border-slate-200 text-left text-[13px] text-slate-500 [&_th]:font-normal">
                <tr>
                  <th className="px-4 py-2.5">SBD</th>
                  <th className="px-4 py-2.5">Họ tên</th>
                  <th className="px-4 py-2.5">Ngày sinh</th>
                  <th className="px-4 py-2.5">Lớp</th>
                  <th className="px-4 py-2.5">Phòng</th>
                  <th className="px-4 py-2.5 text-right">Điểm</th>
                  <th className="px-4 py-2.5">Trạng thái</th>
                  <th className="w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((s) => (
                  <tr key={s.id} className="group hover:bg-primary-softer">
                    <td className="px-4 py-2.5 font-sans tabular">{s.sbd}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-800">{s.full_name}</td>
                    <td className="px-4 py-2.5 text-slate-600">{s.dob}</td>
                    <td className="px-4 py-2.5 text-slate-600">{s.class_name}</td>
                    <td className="px-4 py-2.5 text-slate-600">{s.room}</td>
                    <td className={`px-4 py-2.5 text-right font-semibold tabular ${scoreColor(s.score, exam.max_score)}`}>
                      {s.submission_id ? <Link to={`/submissions/${s.submission_id}`} className="hover:underline">{fmtScore(s.score)}</Link> : "—"}
                    </td>
                    <td className="px-4 py-2.5"><StatusBadge status={s.status} /></td>
                    <td className="px-2 py-2.5 text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
                        <button className="rounded p-1.5 text-text-muted hover:bg-primary-softer hover:text-slate-700" onClick={() => setEditing(s)} title="Sửa">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button className="rounded p-1.5 text-text-muted hover:bg-rose-50 hover:text-rose-600" onClick={() => remove(s)} title="Xóa">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Thêm thí sinh" : "Sửa thí sinh"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>Hủy</Button>
            <Button loading={save.isPending} onClick={() => save.mutate()} disabled={!form.sbd || !form.full_name}>Lưu</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Số báo danh *" hint="Tối đa 6 chữ số">
            <Input value={form.sbd} onChange={(e) => setForm({ ...form, sbd: e.target.value.replace(/\D/g, "").slice(0, 6) })} autoFocus />
          </Field>
          <Field label="Họ và tên *">
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </Field>
          <Field label="Ngày sinh">
            <Input value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} placeholder="dd/mm/yyyy" />
          </Field>
          <Field label="Lớp">
            <Input value={form.class_name} onChange={(e) => setForm({ ...form, class_name: e.target.value })} />
          </Field>
          <Field label="Phòng thi">
            <Input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} />
          </Field>
        </div>
      </Modal>

      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Nhập danh sách thí sinh" description="File Excel (.xlsx) hoặc CSV có dòng tiêu đề: SBD, Họ tên, Ngày sinh, Lớp, Phòng thi.">
        <Dropzone accept=".xlsx,.csv" multiple={false} onFiles={importFile} className="p-8 text-center">
          <FileSpreadsheet className="mx-auto mb-2 h-8 w-8 text-primary" />
          <p className="text-[15px] text-slate-600">Kéo thả file vào đây hoặc bấm để chọn</p>
        </Dropzone>
        <div className="mt-3 flex items-center justify-between">
          <label className="flex items-center gap-2 text-[15px] text-slate-600">
            <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} className="rounded" /> Thay thế toàn bộ danh sách cũ
          </label>
          <button className="text-[15px] font-medium text-brand-700 hover:underline" onClick={() => downloadUrl(`/api/exams/${exam.id}/students/template.xlsx`)}>
            Tải file mẫu
          </button>
        </div>
      </Modal>
    </div>
  );
}
