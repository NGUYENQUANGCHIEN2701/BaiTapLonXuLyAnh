import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useState } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { Badge, Button, Card, Field, Input, Modal, PageHeader, PageLoader, Select, useConfirm } from "../components/ui";
import { api, errMsg } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { Role, User } from "../lib/types";
import { fmtDate } from "../lib/utils";

export default function Users() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ username: "", full_name: "", password: "", role: "teacher" as Role });
  const { data, isLoading } = useQuery({ queryKey: ["users"], queryFn: () => api.get<User[]>("/api/users"), enabled: user?.role === "admin" });
  const create = useMutation({
    mutationFn: () => api.post<User>("/api/users", form),
    onSuccess: () => {
      toast.success("Đã tạo tài khoản");
      setOpen(false);
      setForm({ username: "", full_name: "", password: "", role: "teacher" });
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  if (user?.role !== "admin") return <Navigate to="/" replace />;
  if (isLoading) return <PageLoader />;

  const remove = async (u: User) => {
    if (!(await confirm({ title: `Xóa tài khoản ${u.username}?`, message: "Các kỳ thi của tài khoản này vẫn được giữ lại (chuyển cho quản trị viên quản lý).", danger: true, confirmText: "Xóa" }))) return;
    try {
      await api.del(`/api/users/${u.id}`);
      qc.invalidateQueries({ queryKey: ["users"] });
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="Người dùng" subtitle="Tài khoản giáo viên chỉ thấy các kỳ thi do mình tạo; quản trị viên thấy tất cả."
        actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>Thêm tài khoản</Button>} />
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-2.5">Tên đăng nhập</th>
              <th className="px-5 py-2.5">Họ tên</th>
              <th className="px-5 py-2.5">Vai trò</th>
              <th className="px-5 py-2.5">Ngày tạo</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data?.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-5 py-3 font-medium text-slate-800">{u.username}</td>
                <td className="px-5 py-3">{u.full_name}</td>
                <td className="px-5 py-3">
                  {u.role === "admin" ? <Badge tone="violet"><ShieldCheck className="h-3 w-3" /> Quản trị</Badge> : <Badge>Giáo viên</Badge>}
                </td>
                <td className="px-5 py-3 text-slate-500">{fmtDate(u.created_at)}</td>
                <td className="px-5 py-3 text-right">
                  {u.id !== user.id && (
                    <button className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" onClick={() => remove(u)}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Thêm tài khoản"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Hủy</Button>
            <Button loading={create.isPending} onClick={() => create.mutate()} disabled={form.username.length < 3 || form.password.length < 6}>Tạo</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tên đăng nhập" hint="Tối thiểu 3 ký tự">
            <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.trim() })} autoFocus />
          </Field>
          <Field label="Họ tên">
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </Field>
          <Field label="Mật khẩu" hint="Tối thiểu 6 ký tự">
            <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          <Field label="Vai trò">
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
              <option value="teacher">Giáo viên</option>
              <option value="admin">Quản trị viên</option>
            </Select>
          </Field>
        </div>
      </Modal>
    </div>
  );
}
