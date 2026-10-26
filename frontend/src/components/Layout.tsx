import { useQuery } from "@tanstack/react-query";
import {
  ChevronRight,
  ClipboardList,
  FlaskConical,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  ScanLine,
  Users as UsersIcon,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api, errMsg } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { Exam } from "../lib/types";
import { cn } from "../lib/utils";
import { Button, Field, Input, Modal } from "./ui";

function NavItem({ to, icon, label, end, badge }: { to: string; icon: ReactNode; label: string; end?: boolean; badge?: number }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          isActive ? "bg-white/10 text-white" : "text-brand-100/80 hover:bg-white/5 hover:text-white",
        )
      }
    >
      <span className="shrink-0 [&>svg]:h-[18px] [&>svg]:w-[18px]">{icon}</span>
      <span className="truncate">{label}</span>
      {!!badge && <span className="ml-auto rounded-full bg-amber-400 px-1.5 text-[11px] font-semibold text-amber-950">{badge}</span>}
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
    <div className="flex h-full flex-col bg-gradient-to-b from-brand-950 to-[#121845] px-3 py-4">
      <div className="mb-6 flex items-center gap-3 px-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/20">
          <ScanLine className="h-5 w-5 text-white" />
        </div>
        <div className="leading-tight">
          <div className="font-bold text-white">OMR Exam</div>
          <div className="text-[11px] text-brand-200/70">Quản lý thi & chấm trắc nghiệm</div>
        </div>
      </div>
      <nav className="space-y-1">
        <NavItem to="/" end icon={<LayoutDashboard />} label="Tổng quan" />
        <NavItem to="/exams" icon={<ClipboardList />} label="Kỳ thi" badge={reviewTotal} />
        <NavItem to="/lab" icon={<FlaskConical />} label="Phòng thí nghiệm XLA" />
        {user?.role === "admin" && <NavItem to="/users" icon={<UsersIcon />} label="Người dùng" />}
      </nav>
      {!!exams?.length && (
        <div className="mt-6">
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-brand-200/50">Kỳ thi gần đây</div>
          <div className="space-y-0.5">
            {exams.slice(0, 6).map((e) => (
              <NavLink
                key={e.id}
                to={`/exams/${e.id}`}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 rounded-md px-3 py-1.5 text-[13px] transition-colors",
                    isActive ? "bg-white/10 text-white" : "text-brand-100/70 hover:bg-white/5 hover:text-white",
                  )
                }
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                <span className="truncate">{e.name}</span>
                {e.num_review > 0 && <span className="ml-auto text-[11px] text-amber-300">{e.num_review}</span>}
              </NavLink>
            ))}
          </div>
        </div>
      )}
      <div className="mt-auto rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-sm font-semibold text-white">
            {(user?.full_name || user?.username || "?").trim().split(" ").pop()?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-sm font-medium text-white">{user?.full_name || user?.username}</div>
            <div className="text-[11px] text-brand-200/70">{user?.role === "admin" ? "Quản trị viên" : "Giáo viên"}</div>
          </div>
        </div>
        <div className="mt-3 flex gap-1">
          <button onClick={() => setPwOpen(true)} className="flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs text-brand-100/80 hover:bg-white/10 hover:text-white">
            <KeyRound className="h-3.5 w-3.5" /> Mật khẩu
          </button>
          <button
            onClick={async () => {
              await logout();
              nav("/login");
            }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs text-brand-100/80 hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-3.5 w-3.5" /> Đăng xuất
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-full">
      <aside className="hidden w-64 shrink-0 lg:block">{sidebar}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMobileOpen(false)} />
          <div className="relative h-full w-64">{sidebar}</div>
          <button className="absolute left-[16.5rem] top-4 rounded-full bg-white p-1.5" onClick={() => setMobileOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4 lg:hidden">
          <button onClick={() => setMobileOpen(true)} className="rounded-lg p-1.5 hover:bg-slate-100">
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-semibold">OMR Exam</span>
          <ChevronRight className="h-4 w-4 text-slate-300" />
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
      <PasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
    </div>
  );
}
