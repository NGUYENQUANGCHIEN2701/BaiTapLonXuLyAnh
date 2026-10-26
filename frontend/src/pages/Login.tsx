import { Camera, ChartColumn, ScanLine, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Button, Field, Input } from "../components/ui";
import { errMsg } from "../lib/api";
import { useAuth } from "../lib/auth";

function SheetIllustration() {
  const rows = Array.from({ length: 10 });
  const marks = [1, 3, 0, 2, 2, 1, 0, 3, 1, 2];
  return (
    <svg viewBox="0 0 210 280" className="h-auto w-full max-w-[300px] drop-shadow-2xl" aria-hidden>
      <rect x="0" y="0" width="210" height="280" rx="6" fill="#fff" />
      {[
        [10, 10],
        [188, 10],
        [10, 258],
        [188, 258],
      ].map(([x, y], i) => (
        <g key={i}>
          <rect x={x} y={y} width="12" height="12" fill="#0f172a" />
          {i === 0 && <rect x={x + 3.5} y={y + 3.5} width="5" height="5" fill="#fff" />}
        </g>
      ))}
      <rect x="40" y="16" width="130" height="7" rx="2" fill="#1e2e89" />
      <rect x="62" y="28" width="86" height="4" rx="2" fill="#cbd5e1" />
      {rows.map((_, r) => (
        <g key={r}>
          <text x="38" y={58 + r * 19} fontSize="8" fill="#334155" textAnchor="end" fontWeight="700">
            {r + 1}
          </text>
          {[0, 1, 2, 3].map((c) => (
            <circle
              key={c}
              cx={52 + c * 18}
              cy={55 + r * 19}
              r="6"
              fill={marks[r] === c ? "#1e293b" : "#fff"}
              stroke="#64748b"
              strokeWidth="1"
            />
          ))}
          {[0, 1, 2, 3].map((c) => (
            <circle key={`b${c}`} cx={132 + c * 14} cy={55 + r * 19} r="4.5" fill={(r + c) % 7 === 0 ? "#1e293b" : "#fff"} stroke="#94a3b8" strokeWidth="0.8" />
          ))}
        </g>
      ))}
      <rect x="10" y="120" width="190" height="3" fill="#22c55e" opacity="0.85">
        <animate attributeName="y" values="40;245;40" dur="3.2s" repeatCount="indefinite" />
      </rect>
    </svg>
  );
}

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={(loc.state as { from?: string } | null)?.from ?? "/"} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(username, password);
      nav((loc.state as { from?: string } | null)?.from ?? "/", { replace: true });
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-full">
      <div className="relative hidden w-[52%] overflow-hidden bg-gradient-to-br from-brand-950 via-brand-900 to-brand-700 p-12 text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand-500/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-indigo-400/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
            <ScanLine className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold">OMR Exam</span>
        </div>
        <div className="relative mt-14 grid flex-1 grid-cols-[1fr_auto] items-center gap-10">
          <div>
            <h1 className="text-4xl font-bold leading-tight tracking-tight">
              Quản lý kỳ thi &<br />chấm trắc nghiệm thông minh
            </h1>
            <p className="mt-4 max-w-md text-brand-100/80">
              In phiếu, chụp bằng điện thoại hoặc webcam, chấm tự động bằng xử lý ảnh — kèm thống kê và phân tích câu hỏi.
            </p>
            <ul className="mt-8 space-y-4 text-sm">
              {[
                [Camera, "Nhận diện marker, nắn phối cảnh, tự xoay phiếu"],
                [ShieldCheck, "Gắn cờ câu tô mờ, tô nhiều ô, trùng SBD để duyệt lại"],
                [ChartColumn, "Phổ điểm, độ khó và độ phân biệt từng câu"],
              ].map(([Icon, text], i) => {
                const I = Icon as typeof Camera;
                return (
                  <li key={i} className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                      <I className="h-4 w-4" />
                    </span>
                    <span className="text-brand-50/90">{text as string}</span>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="hidden xl:block">
            <SheetIllustration />
          </div>
        </div>
        <p className="relative text-xs text-brand-200/60">Bài tập lớn môn Xử lý ảnh · OpenCV · FastAPI · React</p>
      </div>

      <div className="flex flex-1 items-center justify-center bg-white p-6">
        <form onSubmit={submit} className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2 text-brand-800">
              <ScanLine className="h-6 w-6" />
              <span className="text-lg font-bold">OMR Exam</span>
            </div>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Đăng nhập</h2>
          <p className="mt-1 text-sm text-slate-500">Chào mừng trở lại! Nhập tài khoản để tiếp tục.</p>
          <div className="mt-8 space-y-4">
            <Field label="Tên đăng nhập">
              <Input autoFocus value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
            </Field>
            <Field label="Mật khẩu">
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </Field>
            {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{error}</div>}
            <Button type="submit" size="lg" className="w-full justify-center" loading={busy}>
              Đăng nhập
            </Button>
          </div>
          <p className="mt-6 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Tài khoản mặc định: <b>admin</b> / <b>admin123</b> — hãy đổi mật khẩu sau khi đăng nhập.
          </p>
        </form>
      </div>
    </div>
  );
}
