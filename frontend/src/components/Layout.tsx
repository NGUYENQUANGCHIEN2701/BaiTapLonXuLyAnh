import { useQuery } from "@tanstack/react-query";
import { Bell, ChevronDown, ChevronRight, ClipboardList, FlaskConical, KeyRound, LayoutGrid, LogOut, Menu, Search, Users as UsersIcon, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api, errMsg } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { Dashboard, Exam } from "../lib/types";
import { cn } from "../lib/utils";
import { Button, Field, Input, Modal } from "./ui";
import ChatWidget from "./chat/ChatWidget";

/** Biểu tượng: 4 marker góc như trên phiếu thật, ô góc trên-trái rỗng. */
export function SheetMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden>
      <rect x="1" y="1" width="18" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <rect x="3.5" y="3.5" width="4" height="4" fill="currentColor" />
      <rect x="4.9" y="4.9" width="1.2" height="1.2" fill="var(--color-bg)" />
      <rect x="12.5" y="3.5" width="4" height="4" fill="currentColor" />
      <rect x="3.5" y="12.5" width="4" height="4" fill="currentColor" />
      <rect x="12.5" y="12.5" width="4" height="4" fill="currentColor" />
      <circle cx="10" cy="10" r="1.8" fill="var(--color-primary)" />
    </svg>
  );
}

function NavItem({ to, icon, label, end, count, dark = false }: { to: string; icon: ReactNode; label: string; end?: boolean; count?: number; dark?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "relative flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] transition-colors duration-150 [&_svg]:h-5 [&_svg]:w-5",
          isActive
            ? dark ? "bg-primary font-semibold text-white shadow-sm [&_svg]:text-white" : "bg-primary-soft font-semibold text-primary-hover [&_svg]:text-primary"
            : dark ? "text-white/90 hover:bg-white/10 hover:text-white [&_svg]:text-white/80" : "text-text-muted hover:bg-primary-softer hover:text-primary-hover [&_svg]:text-text-muted",
        )
      }
    >
      {icon}
      <span className="truncate">{label}</span>
      {!!count && <span className="ml-auto rounded-full bg-warning-soft px-2 py-0.5 text-[13px] font-semibold tabular text-text">{count}</span>}
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
  const isDarkWorkspace = loc.pathname !== "/login";
  const hasBrandedHeader = loc.pathname === "/exams" || loc.pathname.startsWith("/exams/") || loc.pathname === "/users" || loc.pathname === "/lab";
  const isExamDetail = loc.pathname.startsWith("/exams/");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const { data: exams } = useQuery({ queryKey: ["exams"], queryFn: () => api.get<Exam[]>("/api/exams") });
  const { data: dashboard } = useQuery({ queryKey: ["dashboard"], queryFn: () => api.get<Dashboard>("/api/dashboard"), enabled: !!searchText.trim() });
  const reviewTotal = exams?.reduce((s, e) => s + e.num_review, 0) ?? 0;
  const normalizedSearch = searchText.trim().toLocaleLowerCase("vi");
  const examMatches = normalizedSearch ? (exams ?? []).filter((e) => `${e.name} ${e.subject ?? ""}`.toLocaleLowerCase("vi").includes(normalizedSearch)).slice(0, 4) : [];
  const submissionMatches = normalizedSearch ? (dashboard?.recent ?? []).filter((s) => `${s.name ?? ""} ${s.sbd ?? ""} ${s.exam_name}`.toLocaleLowerCase("vi").includes(normalizedSearch)).slice(0, 4) : [];

  useEffect(() => { setMobileOpen(false); setAccountOpen(false); }, [loc.pathname]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
        setSearchOpen(true);
      }
      if (event.key === "Escape") { setSearchOpen(false); setAccountOpen(false); }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !searchWrapRef.current?.contains(event.target)) setSearchOpen(false);
      if (event.target instanceof Node && !accountMenuRef.current?.contains(event.target)) setAccountOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  const signOut = async () => {
    setAccountOpen(false);
    await logout();
    nav("/login");
  };

  const sidebar = (
    <div className={cn("flex h-full flex-col overflow-y-auto border-r px-4 py-6", isDarkWorkspace ? "border-white/10 bg-[linear-gradient(180deg,#082D68_0%,#0756A6_100%)] text-white" : "border-border bg-white")}>
      <div className="mb-8 flex items-center gap-3 px-2">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", isDarkWorkspace ? "bg-primary text-white" : "bg-primary-soft")}><SheetMark className={cn("h-6 w-6", isDarkWorkspace ? "text-white" : "text-primary-hover")} /></div>
        <span className={cn("font-sans text-xl font-bold tracking-tight", isDarkWorkspace ? "text-white" : "text-navy")}>OMR Exam</span>
      </div>
      <nav className="space-y-1.5" aria-label="Điều hướng chính">
        <NavItem to="/" end icon={<LayoutGrid />} label="Tổng quan" dark={isDarkWorkspace} />
        <NavItem to="/exams" icon={<ClipboardList />} label="Kỳ thi" count={reviewTotal} dark={isDarkWorkspace} />
        <NavItem to="/lab" icon={<FlaskConical />} label="Phòng thí nghiệm" dark={isDarkWorkspace} />
        {user?.role === "admin" && <NavItem to="/users" icon={<UsersIcon />} label="Người dùng" dark={isDarkWorkspace} />}
      </nav>
      {!!exams?.length && (
        <div className={cn("mt-8 border-t pt-4", isDarkWorkspace ? "border-white/10" : "border-transparent")}>
          <div className={cn("px-3 pb-2 text-[13px]", isDarkWorkspace ? "text-white/70" : "text-slate-500")}>Kỳ thi gần đây</div>
          <div className="space-y-px">
            {exams.slice(0, 6).map((e) => (
              <NavLink
                key={e.id}
                to={`/exams/${e.id}`}
                className={({ isActive }) =>
                  cn(
                    "flex items-baseline gap-2 rounded-lg px-3 py-2.5 text-[13px] transition-colors",
                    isActive ? (isDarkWorkspace ? "bg-white/15 font-semibold text-white" : "bg-primary-soft font-semibold text-primary-hover") : (isDarkWorkspace ? "text-white/90 hover:bg-white/10 hover:text-white" : "text-text-muted hover:bg-primary-softer hover:text-primary-hover"),
                  )
                }
              >
                <span className="truncate">{e.name}</span>
                {e.num_review > 0 && <span className="ml-auto shrink-0 rounded-full bg-warning-soft px-2 text-[13px] tabular text-text">{e.num_review}</span>}
              </NavLink>
            ))}
          </div>
        </div>
      )}
      {!isDarkWorkspace && <div className="mb-5 mt-auto px-2 pt-6">
        <div className="rounded-xl border border-primary-soft bg-primary-softer px-3 pt-3">
          <svg viewBox="0 0 220 116" className="mx-auto h-[104px] w-full max-w-[210px]" aria-hidden="true">
            <path d="M14 90C24 46 57 27 94 29c28-28 74-25 98 3 21 24 13 52-2 62H31c-12 0-20-1-17-4Z" fill="var(--color-primary-soft)" />
            <g transform="rotate(-10 76 65)"><rect x="42" y="23" width="72" height="83" rx="6" fill="white" stroke="var(--color-border)"/><rect x="52" y="33" width="20" height="5" rx="2" fill="var(--color-primary-soft)"/><path d="M54 48h46M54 57h46M54 66h46M54 75h46M54 84h46" stroke="var(--color-border)" strokeWidth="2"/><g fill="var(--color-primary)"><circle cx="60" cy="49" r="2.5"/><circle cx="69" cy="49" r="2.5"/><circle cx="78" cy="49" r="2.5"/><circle cx="87" cy="49" r="2.5"/><circle cx="60" cy="58" r="2.5"/><circle cx="69" cy="58" r="2.5"/><circle cx="78" cy="58" r="2.5"/><circle cx="87" cy="58" r="2.5"/><circle cx="60" cy="67" r="2.5"/><circle cx="69" cy="67" r="2.5"/><circle cx="78" cy="67" r="2.5"/><circle cx="87" cy="67" r="2.5"/><circle cx="60" cy="76" r="2.5"/><circle cx="69" cy="76" r="2.5"/><circle cx="78" cy="76" r="2.5"/><circle cx="87" cy="76" r="2.5"/></g></g>
            <path d="M108 77h83c4 0 7 3 7 7v16h-99V84c0-4 4-7 9-7Z" fill="var(--color-primary-hover)"/><path d="M98 95h105l-8 12h-91Z" fill="var(--color-primary)"/><path d="M117 82h64" stroke="white" strokeWidth="3" strokeLinecap="round"/><path d="M133 94h34" stroke="var(--color-primary-soft)" strokeWidth="5" strokeLinecap="round"/>
          </svg>
          <p className="mt-1 text-center text-[14px] font-bold text-navy">Chấm bài OMR tự động</p>
          <p className="pb-3 pt-1 text-center text-[12px] leading-5 text-slate-600">Quét – Nhận dạng – Chấm điểm<br />chính xác, nhanh chóng</p>
        </div>
      </div>}
      <div className={cn("mt-auto border-t px-3 pt-4", isDarkWorkspace ? "border-white/15" : "border-slate-200")}>
        {isDarkWorkspace ? <div className="mb-3 flex items-center gap-2 rounded-xl bg-white/10 px-2 py-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20"><UsersIcon className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="truncate text-[13px] font-semibold text-white">{user?.full_name || user?.username}</div><div className="truncate text-[12px] text-blue-100">{user?.username} · {user?.role === "admin" ? "quản trị" : "giáo viên"}</div></div><ChevronRight className="h-4 w-4 shrink-0 text-white/80" /></div> : <div className="truncate text-[13px] font-medium text-slate-900">{user?.full_name || user?.username}</div>}
        {!isDarkWorkspace && <div className="text-[13px] text-slate-500">
          {user?.username} · {user?.role === "admin" ? "quản trị" : "giáo viên"}
        </div>}
        <div className={cn("mt-2.5 text-[13px]", isDarkWorkspace ? "flex flex-col gap-1 text-[14px]" : "flex gap-3")}>
          <button onClick={() => setPwOpen(true)} className={cn(isDarkWorkspace ? "flex min-h-10 items-center rounded-lg px-2 text-white/90 hover:bg-white/10 hover:text-white" : "text-slate-600 underline-offset-2 hover:text-primary-hover hover:underline")}>
            {isDarkWorkspace && <KeyRound className="mr-3 inline h-[18px] w-[18px]" />}Đổi mật khẩu
          </button>
          <button
            onClick={async () => {
              await logout();
              nav("/login");
            }}
            className={cn(isDarkWorkspace ? "flex min-h-10 items-center rounded-lg px-2 text-white/90 hover:bg-white/10 hover:text-white" : "text-slate-600 underline-offset-2 hover:text-primary-hover hover:underline")}
          >
            {isDarkWorkspace && <LogOut className="mr-3 h-[18px] w-[18px]" />}Đăng xuất
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-full min-w-0 bg-white">
      <aside className={cn("hidden shrink-0 lg:block", isExamDetail ? "w-[240px]" : isDarkWorkspace ? "w-[264px]" : "w-[276px]")}>{sidebar}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-navy/40" onClick={() => setMobileOpen(false)} />
          <div className="relative h-full w-60">{sidebar}</div>
          <button aria-label="Đóng menu" className="absolute left-[15.5rem] top-4 rounded-lg border border-border bg-white p-2 hover:bg-primary-softer" onClick={() => setMobileOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="relative z-20 flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-border bg-white px-4 py-2 sm:px-6 lg:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button aria-label="Mở menu" onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-text-muted hover:bg-primary-softer hover:text-primary-hover lg:hidden"><Menu className="h-5 w-5" /></button>
            {hasBrandedHeader ? <div className="flex items-center gap-2.5 pl-2"><SheetMark className="h-7 w-7 text-primary-hover" /><span className="font-sans text-lg font-bold text-navy">OMR Exam</span></div> : <div ref={searchWrapRef} className="relative w-full max-w-[470px]">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
              <input ref={searchRef} aria-label="Tìm kiếm kỳ thi, thí sinh, SBD" placeholder="Tìm kiếm kỳ thi, thí sinh, SBD..." value={searchText} onFocus={() => setSearchOpen(true)} onChange={(e) => { setSearchText(e.target.value); setSearchOpen(true); }} onKeyDown={(e) => { if (e.key === "Escape") setSearchOpen(false); }} className="h-11 w-full rounded-xl border border-primary/25 bg-surface pl-11 pr-14 text-[14px] text-text placeholder:text-slate-500 hover:border-primary focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/15" />
              <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-border bg-white px-1.5 py-0.5 text-[12px] text-slate-500">⌘ K</kbd>
              {searchOpen && searchText.trim() && <div className="absolute left-0 right-0 top-[calc(100%+8px)] max-h-[min(60vh,420px)] overflow-y-auto rounded-xl border border-border bg-white p-2 shadow-md">
                {examMatches.map((exam) => <Link key={`exam-${exam.id}`} to={`/exams/${exam.id}`} onClick={() => { setSearchText(""); setSearchOpen(false); }} className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-[14px] text-text hover:bg-primary-softer"><ClipboardList className="h-4 w-4 shrink-0 text-primary" /><span className="min-w-0 flex-1 truncate">{exam.name}</span><span className="text-[12px] text-slate-500">Kỳ thi</span></Link>)}
                {submissionMatches.map((submission) => <Link key={`submission-${submission.id}`} to={`/submissions/${submission.id}`} onClick={() => { setSearchText(""); setSearchOpen(false); }} className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-[14px] text-text hover:bg-primary-softer"><Search className="h-4 w-4 shrink-0 text-primary" /><span className="min-w-0 flex-1 truncate">{submission.name || "Không rõ thí sinh"} · {submission.sbd || "Chưa có SBD"}</span><span className="text-[12px] text-slate-500">Bài làm</span></Link>)}
                {!dashboard && !examMatches.length && <p className="px-3 py-3 text-[13px] text-slate-500">Đang tìm...</p>}
                {dashboard && !examMatches.length && !submissionMatches.length && <p className="px-3 py-3 text-[13px] text-slate-500">Không tìm thấy kỳ thi hoặc bài chấm gần đây.</p>}
              </div>}
            </div>}
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3" aria-label="Tài khoản hiện tại">
            <Link to="/exams" aria-label={reviewTotal ? `${reviewTotal} bài cần xem lại` : "Kỳ thi"} className="relative flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-primary-softer hover:text-primary-hover"><Bell className="h-5 w-5" />{reviewTotal > 0 && <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full border-2 border-white bg-warning" />}</Link>
            <span className="mx-1 hidden h-8 w-px bg-border sm:block" />
            <div ref={accountMenuRef} className="relative">
              <button type="button" aria-haspopup="menu" aria-expanded={accountOpen} aria-label="Mở menu tài khoản" onClick={() => setAccountOpen((open) => !open)} className="flex items-center gap-2 rounded-xl px-1.5 py-1 text-left transition-colors hover:bg-primary-softer focus-visible:outline-2 focus-visible:outline-primary sm:gap-3">
                <span className="hidden text-right sm:block"><span className="block max-w-48 truncate text-[14px] font-semibold text-navy">{user?.full_name || user?.username}</span><span className="block text-[13px] text-slate-500">{user?.role === "admin" ? "Quản trị viên" : "Giáo viên"}</span></span>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-base font-semibold text-primary-hover">{(user?.full_name || user?.username || "U").charAt(0).toUpperCase()}</span>
                <ChevronDown className={cn("h-4 w-4 text-slate-500 transition-transform", accountOpen && "rotate-180")} />
              </button>
              {accountOpen && <div role="menu" aria-label="Menu tài khoản" className="absolute right-0 top-[calc(100%+10px)] z-50 w-64 overflow-hidden rounded-xl border border-border bg-white py-1.5 shadow-md">
                <div className="border-b border-border px-4 py-3"><p className="truncate text-[14px] font-semibold text-navy">{user?.full_name || user?.username}</p><p className="truncate text-[12px] text-slate-500">{user?.username} · {user?.role === "admin" ? "Quản trị viên" : "Giáo viên"}</p></div>
                <button type="button" role="menuitem" onClick={() => { setAccountOpen(false); setPwOpen(true); }} className="flex min-h-11 w-full items-center gap-3 px-4 text-left text-[14px] font-medium text-slate-700 hover:bg-primary-softer hover:text-primary-hover"><KeyRound className="h-[17px] w-[17px]" />Đổi mật khẩu</button>
                <button type="button" role="menuitem" onClick={() => void signOut()} className="flex min-h-11 w-full items-center gap-3 px-4 text-left text-[14px] font-medium text-danger hover:bg-danger-soft"><LogOut className="h-[17px] w-[17px]" />Đăng xuất</button>
              </div>}
            </div>
          </div>
        </header>
        <main className="min-w-0 flex-1 overflow-y-auto bg-surface">
          <div className={cn("mx-auto w-full max-w-[1440px] px-4 pb-24 sm:px-6 sm:pb-24 lg:px-8", isExamDetail ? "py-2 sm:py-2" : "py-6 sm:py-8")}>
            <Outlet />
          </div>
        </main>
      </div>
      <PasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
      {user && <ChatWidget key={user.id} userId={user.id} />}
    </div>
  );
}
