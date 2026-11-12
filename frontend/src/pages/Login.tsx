import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { BarChart3, Eye, EyeOff, GraduationCap, LockKeyhole, LogIn, ScanLine, ShieldCheck, UserRound, UsersRound, Zap } from "lucide-react";
import { Button, Field, Input } from "../components/ui";
import { errMsg } from "../lib/api";
import { useAuth } from "../lib/auth";

function GradedSheet() {
  const answers = [2, 0, 1, 3, 0, 2, 1, 3, 0, 2];
  const wrong = new Set([2, 5, 8]);
  return (
    <svg viewBox="0 0 470 390" className="h-auto w-full overflow-visible" role="img" aria-label="Phiếu trắc nghiệm được hệ thống nhận dạng và chấm điểm">
      <defs>
        <linearGradient id="sheetShadow" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#DCEBFF" /><stop offset="1" stopColor="#A8D6FF" /></linearGradient>
        <linearGradient id="scanGlow" x1="0" x2="1"><stop stopColor="#43D7FF" stopOpacity="0" /><stop offset=".48" stopColor="#43D7FF" /><stop offset="1" stopColor="#43D7FF" stopOpacity="0" /></linearGradient>
        <filter id="softShadow" x="-.3" y="-.3" width="1.6" height="1.7"><feDropShadow dx="0" dy="12" stdDeviation="12" floodColor="#06285B" floodOpacity=".28" /></filter>
      </defs>
      <path d="M133 89 203 48l150 203-70 45z" fill="#31A9F5" opacity=".42" />
      <g transform="rotate(4 248 194)" filter="url(#softShadow)">
        <rect x="143" y="26" width="214" height="330" rx="17" fill="url(#sheetShadow)" opacity=".62" />
        <rect x="132" y="19" width="214" height="330" rx="15" fill="#fff" />
        {[ [150,37], [321,37], [150,321], [321,321] ].map(([x,y],i) => <rect key={i} x={x} y={y} width="12" height="12" fill="#0B1F48" />)}
        <text x="239" y="57" textAnchor="middle" fill="#102C59" fontFamily="sans-serif" fontWeight="700" fontSize="12">Phiếu trả lời trắc nghiệm</text>
        <path d="M184 66h110" stroke="#D5E4F6" strokeWidth="1.5" />
        {answers.map((answer,row) => {
          const y = 91 + row * 23;
          return <g key={row}>
            <text x="168" y={y+4} textAnchor="end" fill="#14294D" fontFamily="sans-serif" fontWeight="700" fontSize="10">{row+1}</text>
            {[0,1,2,3].map((col) => <circle key={col} cx={187 + col*22} cy={y} r="7.3" fill={col===answer ? "#0758A9" : "#fff"} stroke={col===answer ? "#0758A9" : "#9BC9F5"} strokeWidth="1.6" />)}
            {wrong.has(row)
              ? <path d={`M286 ${y-5}l10 10m0-10-10 10`} stroke="#DC2626" strokeWidth="3" strokeLinecap="round" />
              : <path d={`m286 ${y} 4 5 10-12`} fill="none" stroke="#16A34A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
          </g>;
        })}
      </g>
      <g transform="translate(25 162)">
        <rect width="88" height="88" rx="23" fill="#0B68BB" stroke="#43D7FF" strokeWidth="2" />
        <path d="M23 34V25q0-4 4-4h10M65 34V25q0-4-4-4H51M23 54v9q0 4 4 4h10M65 54v9q0 4-4 4H51" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
        <rect x="34" y="34" width="20" height="19" rx="4" fill="#43D7FF" />
        <path d="M30 47h28" stroke="#A4F3FF" strokeWidth="3" />
      </g>
      <g filter="url(#softShadow)">
        <rect x="338" y="139" width="119" height="126" rx="20" fill="#fff" />
        <text x="360" y="175" fill="#102C59" fontFamily="sans-serif" fontWeight="700" fontSize="15">Điểm</text>
        <text x="356" y="226" fill="#0758B8" fontFamily="sans-serif" fontWeight="700" fontSize="42">8,5</text>
        <text x="419" y="225" fill="#8BAED8" fontFamily="sans-serif" fontWeight="700" fontSize="20">/10</text>
        <path d="M356 240h45" stroke="#087BCE" strokeWidth="3" strokeLinecap="round" />
        <circle cx="438" cy="135" r="20" fill="#16A34A" stroke="#fff" strokeWidth="2" />
        <path d="m430 135 5 5 11-12" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <path d="M136 15h-18q-12 0-12 12v20M351 15h18q12 0 12 12v20M125 350h-18q-12 0-12-12v-20M343 350h18q12 0 12-12v-20" fill="none" stroke="#48D8FF" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M142 182h212" stroke="url(#scanGlow)" strokeWidth="4" opacity=".9" />
    </svg>
  );
}

const features = [
  { icon: <Zap />, title: "Chấm điểm tự động", detail: "Nhanh chóng, chính xác" },
  { icon: <BarChart3 />, title: "Thống kê kết quả", detail: "Tổng hợp, trực quan" },
  { icon: <UsersRound />, title: "Quản lý kỳ thi", detail: "Linh hoạt, dễ sử dụng" },
  { icon: <ShieldCheck />, title: "Độ tin cậy cao", detail: "Giảm sai sót, tiết kiệm thời gian" },
];

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    <main className="grid min-h-full bg-white lg:grid-cols-[42%_58%]">
      <section className="flex min-w-0 flex-col px-5 py-7 sm:px-10 lg:px-[clamp(32px,4.8vw,80px)] lg:py-12">
        <div className="mx-auto flex w-full max-w-[585px] items-center gap-4">
          <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-[18px] bg-primary text-white shadow-md"><ScanLine className="h-10 w-10" strokeWidth={2.4} /></div>
          <div className="min-w-0"><div className="text-[32px] font-bold leading-tight tracking-tight text-navy sm:text-[38px]">OMR Exam</div><p className="mt-1 text-[14px] font-medium leading-5 text-slate-600 sm:text-[16px]">Hệ thống chấm điểm tự động phiếu câu trả lời</p></div>
        </div>

        <form onSubmit={submit} className="relative mx-auto my-8 w-full max-w-[585px] rounded-[26px] border border-primary-soft bg-white p-6 shadow-md sm:p-8 lg:my-auto lg:p-10">
          <div aria-hidden className="pointer-events-none absolute right-7 top-7 hidden h-[132px] w-[142px] items-center justify-center rounded-full bg-primary-softer sm:flex">
            <svg viewBox="0 0 140 128" className="h-full w-full">
              <rect x="29" y="19" width="77" height="92" rx="12" fill="#fff" stroke="#96C5FA" strokeWidth="4" transform="rotate(8 65 64)" />
              <rect x="45" y="15" width="46" height="12" rx="6" fill="#0875D1" />
              {[0,1,2,3].map((row) => [0,1,2].map((col) => <circle key={`${row}-${col}`} cx={48+col*19} cy={44+row*15} r="5.5" fill={row===2&&col===1 ? "#2FA8FF" : "#fff"} stroke="#7DBAFF" strokeWidth="2" />))}
              <path d="m89 71 24-26q7-7 13-1 4 4-1 10l-27 31" fill="#0875D1" />
              <circle cx="93" cy="89" r="25" fill="#1687E8" stroke="#fff" strokeWidth="4" />
              <path d="m82 89 8 8 15-17" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="max-w-[360px] sm:pr-[125px]">
            <p className="mb-2 text-[14px] font-medium text-slate-600">Chào mừng bạn quay lại!</p>
            <h1 className="text-[34px] font-bold leading-tight tracking-tight text-navy sm:text-[42px]">Đăng nhập</h1>
            <p className="mt-3 text-[15px] leading-6 text-slate-600">Quản lý kỳ thi và chấm điểm phiếu trắc nghiệm tự động, chính xác, nhanh chóng.</p>
          </div>

          <div className="mt-7 space-y-5">
            <Field label={<span className="flex items-center gap-2 font-semibold text-navy"><UserRound className="h-5 w-5 text-slate-600" />Tên đăng nhập</span>}>
              <Input autoFocus value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" className="h-[52px] rounded-xl border-primary/30 px-4 font-medium text-navy" />
            </Field>
            <Field label={<span className="flex items-center gap-2 font-semibold text-navy"><LockKeyhole className="h-5 w-5 text-slate-600" />Mật khẩu</span>}>
              <div className="relative">
                <Input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className="h-[52px] rounded-xl border-primary/30 px-4 pr-12 font-medium text-navy" />
                <button type="button" aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"} aria-pressed={showPassword} onClick={() => setShowPassword((show) => !show)} className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-primary-softer hover:text-primary-hover">
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </Field>
            {error && <p role="alert" className="rounded-lg border-l-4 border-danger bg-danger-soft p-3 text-[14px] text-text">{error}</p>}
            <Button type="submit" size="lg" icon={<LogIn />} className="mt-1 h-[58px] w-full justify-center rounded-xl" loading={busy}>Đăng nhập</Button>
          </div>
          <p className="mt-6 text-center text-[14px] text-slate-600">Tài khoản mặc định: <span className="font-semibold text-primary-hover">admin / admin123</span></p>
        </form>

        <p className="mx-auto flex w-full max-w-[585px] items-center justify-center gap-3 text-center text-[13px] text-slate-600 sm:justify-start"><GraduationCap className="h-5 w-5 text-primary-hover" /><span className="font-semibold text-navy">OMR Exam</span><span aria-hidden className="h-4 w-px bg-border" />Giải pháp chấm thi trắc nghiệm tự động</p>
      </section>

      <section className="relative hidden min-h-[680px] overflow-hidden bg-[#063878] text-white lg:flex lg:flex-col lg:items-center lg:justify-between lg:px-8 lg:pb-10 lg:pt-[82px] xl:px-12">
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,#0B63AE_0%,#073D7C_48%,#05265B_100%)]" />
          <div className="absolute -right-[14%] -top-[25%] h-[68%] w-[75%] rounded-full bg-sky-400/10" />
          <div className="absolute -bottom-[36%] -left-[10%] h-[65%] w-[125%] rounded-[50%] bg-blue-500/10" />
          <div className="absolute bottom-0 right-0 h-1/3 w-full bg-[linear-gradient(0deg,rgba(0,123,213,.18),transparent)]" />
        </div>
        <svg aria-hidden className="pointer-events-none absolute inset-y-0 left-0 h-full w-[84px]" viewBox="0 0 84 1000" preserveAspectRatio="none"><path d="M0 0h84C40 76 10 161 0 241c-13 111 34 181 26 285-8 110-2 247-26 474H0Z" fill="white" /></svg>
        <header className="relative z-[1] max-w-[820px] text-center">
          <h2 className="text-[28px] font-bold leading-tight text-white xl:text-[32px]">Chấm bài trắc nghiệm nhanh – chính xác – tự động</h2>
          <p className="mx-auto mt-3 max-w-[690px] text-[17px] leading-7 text-blue-50">Từ một ảnh chụp, hệ thống tự động nhận dạng phiếu OMR,<br className="hidden xl:block" /> chấm điểm, tổng hợp kết quả và thống kê chi tiết.</p>
          <span className="mx-auto mt-5 block h-1.5 w-24 rounded-full bg-sky-400" />
        </header>

        <div className="relative z-[1] my-3 w-full max-w-[600px] xl:max-w-[680px]"><GradedSheet /></div>

        <ul className="relative z-[1] grid w-full max-w-[900px] grid-cols-4 divide-x divide-sky-300/30">
          {features.map((feature) => <li key={feature.title} className="flex min-w-0 flex-col items-center px-2 text-center">
            <span className="mb-2 flex h-14 w-14 items-center justify-center rounded-full border border-sky-300/30 bg-sky-300/20 text-white [&_svg]:h-7 [&_svg]:w-7">{feature.icon}</span>
            <span className="text-[14px] font-bold leading-5 text-white xl:text-[16px]">{feature.title}</span>
            <span className="mt-1 text-[12px] leading-5 text-blue-100 xl:text-[13px]">{feature.detail}</span>
          </li>)}
        </ul>
      </section>
    </main>
  );
}
