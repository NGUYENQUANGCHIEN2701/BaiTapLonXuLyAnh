import { useQuery } from "@tanstack/react-query";
import { ClipboardList, FlaskConical, LayoutGrid, Menu, Users as UsersIcon, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api, errMsg } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { Exam } from "../lib/types";
import { cn } from "../lib/utils";
import { Button, Field, Input, Modal } from "./ui";

/** Biểu tượng: 4 marker góc như trên phiếu thật, ô góc trên-trái rỗng. */
export function SheetMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden>
      <rect x="1" y="1" width="18" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <rect x="3.5" y="3.5" width="4" height="4" fill="currentColor" />
      <rect x="4.9" y="4.9" width="1.2" height="1.2" fill="#fff" />
      <rect x="12.5" y="3.5" width="4" height="4" fill="currentColor" />
      <rect x="3.5" y="12.5" width="4" height="4" fill="currentColor" />
      <rect x="12.5" y="12.5" width="4" height="4" fill="currentColor" />
      <circle cx="10" cy="10" r="1.8" fill="var(--color-mark)" />
    </svg>
  );
}

function NavItem({ to, icon, label, end, count }: { to: string; icon: ReactNode; label: string; end?: boolean; count?: number }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "relative flex items-center gap-2.5 rounded-md px-3 py-[7px] text-[14px] transition-colors [&_svg]:h-4 [&_svg]:w-4",
          isActive
            ? "bg-white font-medium text-slate-900 shadow-[0_0_0_1px_var(--color-slate-200)] before:absolute before:inset-y-1.5 before:-left-3 before:w-[3px] before:rounded-r before:bg-mark [&_svg]:text-slate-900"
            : "text-slate-600 hover:bg-slate-200/50 hover:text-slate-900 [&_svg]:text-slate-400",
        )
      }
    >
      {icon}
      <span className="truncate">{label}</span>
      {!!count && <span className="ml-auto text-[12px] font-medium tabular text-mark">{count}</span>}
    </NavLink>
  );
}

function PasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [oldPw, setOld] = useState("");
  const [newPw, setNew] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await api.post("/api/auth/password", { old_password: oldPw, new_password: newPw });
      toast.success("Đã đổi mật khẩu");
      onClose();
      setOld("");
      setNew("");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Đổi mật khẩu"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={submit} loading={busy} disabled={newPw.length < 6}>
            Lưu
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Mật khẩu hiện tại">
          <Input type="password" value={oldPw} onChange={(e) => setOld(e.target.value)} />
        </Field>
        <Field label="Mật khẩu mới" hint="Tối thiểu 6 ký tự">
          <Input type="password" value={newPw} onChange={(e) => setNew(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const { data: exams } = useQuery({ queryKey: ["exams"], queryFn: () => api.get<Exam[]>("/api/exams") });
  const reviewTotal = exams?.reduce((s, e) => s + e.num_review, 0) ?? 0;

  useEffect(() => setMobileOpen(false), [loc.pathname]);

  const sidebar = (
    <div className="flex h-full flex-col border-r border-slate-200 bg-paper px-3 py-5">
      <div className="mb-7 flex items-center gap-2.5 px-3">
        <SheetMark className="h-6 w-6 text-slate-900" />
        <span className="font-display text-[19px] font-semibold tracking-tight text-slate-900">OMR Exam</span>
      </div>
      <nav className="space-y-0.5">
        <NavItem to="/" end icon={<LayoutGrid />} label="Tổng quan" />
        <NavItem to="/exams" icon={<ClipboardList />} label="Kỳ thi" count={reviewTotal} />
        <NavItem to="/lab" icon={<FlaskConical />} label="Phòng thí nghiệm" />
        {user?.role === "admin" && <NavItem to="/users" icon={<UsersIcon />} label="Người dùng" />}
      </nav>
      {!!exams?.length && (
        <div className="mt-8">
          <div className="px-3 pb-2 text-[12px] text-slate-500">Kỳ thi gần đây</div>
          <div className="space-y-px">
            {exams.slice(0, 6).map((e) => (
              <NavLink
                key={e.id}
                to={`/exams/${e.id}`}
                className={({ isActive }) =>
                  cn(
                    "flex items-baseline gap-2 rounded-md px-3 py-1.5 text-[13px] transition-colors",
                    isActive ? "bg-white text-slate-900 shadow-[0_0_0_1px_var(--color-slate-200)]" : "text-slate-600 hover:text-slate-900",
                  )
                }
              >
                <span className="truncate">{e.name}</span>
                {e.num_review > 0 && <span className="ml-auto shrink-0 text-[11px] tabular text-mark">{e.num_review}</span>}
              </NavLink>
            ))}
          </div>
        </div>
      )}
      <div className="mt-auto border-t border-slate-200 px-3 pt-4">
        <div className="truncate text-[13px] font-medium text-slate-900">{user?.full_name || user?.username}</div>
        <div className="text-[12px] text-slate-500">
          {user?.username} · {user?.role === "admin" ? "quản trị" : "giáo viên"}
        </div>
        <div className="mt-2.5 flex gap-3 text-[12px]">
          <button onClick={() => setPwOpen(true)} className="text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline">
            Đổi mật khẩu
          </button>
          <button
            onClick={async () => {
              await logout();
              nav("/login");
            }}
            className="text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
          >
            Đăng xuất
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-full">
      <aside className="hidden w-60 shrink-0 lg:block">{sidebar}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/30" onClick={() => setMobileOpen(false)} />
          <div className="relative h-full w-60">{sidebar}</div>
          <button className="absolute left-[15.5rem] top-4 rounded-md border border-slate-300 bg-white p-1.5" onClick={() => setMobileOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-slate-200 bg-paper px-4 lg:hidden">
          <button onClick={() => setMobileOpen(true)} className="rounded-md p-1.5 hover:bg-slate-200/60">
            <Menu className="h-5 w-5" />
          </button>
          <SheetMark className="h-5 w-5" />
          <span className="font-display text-lg font-semibold">OMR Exam</span>
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1360px] px-4 py-7 sm:px-6 lg:px-10">
            <Outlet />
          </div>
        </main>
      </div>
      <PasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
    </div>
  );
}
