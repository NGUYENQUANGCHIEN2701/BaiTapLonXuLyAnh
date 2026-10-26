import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { SheetMark } from "../components/Layout";
import { Button, Field, Input } from "../components/ui";
import { errMsg } from "../lib/api";
import { useAuth } from "../lib/auth";

/** Một tờ phiếu đã chấm: nét chì xám, dấu chấm của giáo viên bằng bút đỏ. */
function GradedSheet() {
  const marks = [1, 3, 0, 2, 2, 1, 0, 3, 1, 2, 0, 3];
  const wrong = new Set([4, 9]);
  const keyFor = (r: number) => (wrong.has(r) ? (marks[r] + 1) % 4 : marks[r]);
  return (
    <svg viewBox="0 0 230 320" className="h-auto w-full" aria-hidden>
      <defs>
        <filter id="graphite" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="2" seed="3" />
          <feColorMatrix values="0 0 0 0 0.16  0 0 0 0 0.16  0 0 0 0 0.15  0 0 0 0.55 0" />
          <feComposite in2="SourceGraphic" operator="in" />
          <feMerge>
            <feMergeNode in="SourceGraphic" />
            <feMergeNode />
          </feMerge>
        </filter>
      </defs>
      <rect x="0" y="0" width="230" height="320" fill="#fffefb" stroke="#d9d5ca" />
      {[
        [10, 10],
        [208, 10],
        [10, 298],
        [208, 298],
      ].map(([x, y], i) => (
        <g key={i}>
          <rect x={x} y={y} width="12" height="12" fill="#1d1c19" />
          {i === 0 && <rect x={x + 3.6} y={y + 3.6} width="4.8" height="4.8" fill="#fffefb" />}
        </g>
      ))}
      <text x="115" y="32" textAnchor="middle" fontFamily="Be Vietnam Pro" fontWeight="700" fontSize="9.5" fill="#1d1c19" letterSpacing="0.3">
        PHIẾU TRẢ LỜI TRẮC NGHIỆM
      </text>
      <line x1="62" y1="40" x2="168" y2="40" stroke="#cfcabd" strokeWidth="1" />
      {marks.map((m, r) => {
        const y = 62 + r * 18.5;
        return (
          <g key={r}>
            <text x="44" y={y + 3} textAnchor="end" fontFamily="Be Vietnam Pro" fontSize="7.5" fontWeight="600" fill="#58554e">
              {r + 1}
            </text>
            {[0, 1, 2, 3].map((c) => (
              <circle key={c} cx={58 + c * 17} cy={y} r="5.6" fill="#fffefb" stroke="#8f8a7d" strokeWidth="0.8" />
            ))}
            <ellipse cx={58 + m * 17 + 0.4} cy={y + 0.3} rx="5" ry="4.7" fill="#3a3833" filter="url(#graphite)" transform={`rotate(${(r * 37) % 30 - 15} ${58 + m * 17} ${y})`} />
            {wrong.has(r) && <circle cx={58 + keyFor(r) * 17} cy={y} r="7.6" fill="none" stroke="var(--color-mark)" strokeWidth="1.3" />}
            <path
              d={wrong.has(r) ? `M ${136} ${y - 4} l 8 8 M ${144} ${y - 4} l -8 8` : `M ${135} ${y} l 3.5 4 l 7 -8`}
              stroke="var(--color-mark)"
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        );
      })}
      <text x="190" y="104" textAnchor="middle" fontFamily="Source Serif 4" fontStyle="italic" fontSize="34" fill="var(--color-mark)" transform="rotate(-8 190 104)">
        8,5
      </text>
      <path d="M 170 116 q 20 6 40 -2" stroke="var(--color-mark)" strokeWidth="1.3" fill="none" strokeLinecap="round" />
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
  const from = (loc.state as { from?: string } | null)?.from ?? "/";

  if (user) return <Navigate to={from} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(username, password);
      nav(from, { replace: true });
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-full lg:grid-cols-[minmax(420px,1fr)_1.15fr]">
      <div className="flex flex-col px-8 py-8 sm:px-14">
        <div className="flex items-center gap-2.5">
          <SheetMark className="h-6 w-6 text-slate-900" />
          <span className="font-display text-[19px] font-semibold tracking-tight">OMR Exam</span>
        </div>

        <form onSubmit={submit} className="my-auto w-full max-w-[360px] py-12">
          <h1 className="font-display text-[34px] font-semibold leading-tight text-slate-900">Đăng nhập</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-slate-500">Quản lý kỳ thi và chấm phiếu trắc nghiệm từ ảnh chụp.</p>
          <div className="mt-9 space-y-4">
            <Field label="Tên đăng nhập">
              <Input autoFocus value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" className="h-10" />
            </Field>
            <Field label="Mật khẩu">
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className="h-10" />
            </Field>
            {error && <p className="border-l-2 border-mark pl-3 text-sm text-mark">{error}</p>}
            <Button type="submit" size="lg" className="mt-2 w-full justify-center" loading={busy}>
              Đăng nhập
            </Button>
          </div>
          <p className="mt-6 text-[13px] text-slate-500">
            Tài khoản mặc định <span className="font-mono text-slate-700">admin / admin123</span>
          </p>
        </form>

        <p className="text-[12px] text-slate-400">Bài tập lớn môn Xử lý ảnh</p>
      </div>

      <div className="relative hidden overflow-hidden border-l border-slate-200 bg-[#ebe7dd] lg:block">
        <div className="absolute inset-0 opacity-[0.35] [background-image:radial-gradient(#cfc9ba_0.6px,transparent_0.6px)] [background-size:6px_6px]" />
        <div className="relative flex h-full flex-col items-center justify-center px-16">
          <div className="w-full max-w-[400px] -rotate-[4deg] shadow-[0_30px_60px_-30px_rgb(29_28_25/0.45),0_4px_10px_-4px_rgb(29_28_25/0.2)]">
            <GradedSheet />
          </div>
          <p className="mt-12 max-w-[400px] text-center font-display text-[17px] italic leading-relaxed text-slate-600">
            Chụp tờ phiếu — hệ thống tìm bốn góc, nắn phẳng ảnh và đọc từng ô tô.
          </p>
        </div>
      </div>
    </div>
  );
}
