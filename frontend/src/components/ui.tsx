import { Loader2, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/utils";

/* ---------- Button ---------- */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success" | "outline";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-slate-900 text-white hover:bg-slate-700",
  secondary: "bg-white text-slate-800 border border-slate-300 hover:border-slate-400 hover:bg-slate-50",
  outline: "bg-transparent text-slate-900 border border-slate-900 hover:bg-slate-900 hover:text-white",
  ghost: "text-slate-600 hover:bg-slate-200/60 hover:text-slate-900",
  danger: "bg-mark text-white hover:brightness-110",
  success: "bg-[#1e6b3a] text-white hover:bg-[#185a30]",
};

export function Button({
  variant = "primary",
  size = "md",
  loading,
  icon,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: "sm" | "md" | "lg" | "icon";
  loading?: boolean;
  icon?: ReactNode;
}) {
  const sizes = {
    sm: "h-7 px-2.5 text-xs gap-1.5",
    md: "h-9 px-3.5 text-sm gap-2",
    lg: "h-11 px-5 text-[15px] gap-2",
    icon: "h-8 w-8 justify-center",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center rounded-md font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap [&_svg]:h-4 [&_svg]:w-4",
        VARIANTS[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Loader2 className="animate-spin" /> : icon}
      {children}
    </button>
  );
}

/* ---------- Card ---------- */

export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-lg border border-slate-200 bg-white", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, actions, className }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-3.5", className)}>
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>
        {subtitle && <p className="mt-0.5 text-[13px] text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ---------- Badge ---------- */

const TONES = {
  gray: "bg-slate-100 text-slate-700",
  blue: "bg-[#e9edf3] text-[#2a4365]",
  green: "bg-[#e5f0e8] text-[#1e6b3a]",
  amber: "bg-[#f8eed6] text-[#7c5300]",
  red: "bg-mark-soft text-mark",
  violet: "bg-slate-900 text-white",
};
export type Tone = keyof typeof TONES;

export function Badge({ tone = "gray", children, className }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11.5px] font-medium leading-4 whitespace-nowrap [&_svg]:h-3 [&_svg]:w-3", TONES[tone], className)}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-[13px] text-slate-400">Chưa nộp</span>;
  const map: Record<string, [string, string]> = {
    graded: ["bg-[#1e6b3a]", "Đã chấm"],
    review: ["bg-[#d08700]", "Cần xem lại"],
    error: ["bg-mark", "Lỗi"],
  };
  const [c, label] = map[status] ?? ["bg-slate-400", status];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] text-slate-700">
      <span className={cn("h-2 w-2 rounded-[2px]", c)} />
      {label}
    </span>
  );
}

/* ---------- Form ---------- */

export function Field({ label, hint, error, children, className }: { label?: ReactNode; hint?: ReactNode; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      {label && <span className="mb-1.5 block text-[13px] font-medium text-slate-700">{label}</span>}
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-mark">{error}</span>}
    </label>
  );
}

const inputCls =
  "block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-[border-color,box-shadow] focus:border-slate-900 focus:shadow-[0_0_0_3px_rgb(29_28_25/0.08)] disabled:bg-slate-100 disabled:text-slate-500";

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputCls, "h-9", className)} {...rest} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputCls, className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(inputCls, "h-9 pr-8", className)} {...rest}>
      {children}
    </select>
  );
}

/* ---------- Misc ---------- */

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-5 w-5 animate-spin text-slate-500", className)} />;
}

export function PageLoader() {
  return (
    <div className="flex h-64 items-center justify-center">
      <Spinner className="h-6 w-6" />
    </div>
  );
}

export function Empty({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && <div className="mb-3 text-slate-400 [&_svg]:h-7 [&_svg]:w-7">{icon}</div>}
      <h3 className="font-display text-xl text-slate-900">{title}</h3>
      {description && <p className="mt-1.5 max-w-md text-sm leading-relaxed text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5 text-[13px] text-slate-500">{eyebrow}</div>}
        <h1 className="font-display text-[30px] font-semibold leading-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Một ô số liệu. Đặt trong <StatStrip> để thành một dải ngăn bằng đường kẻ. */
export function StatCard({ label, value, hint, tone }: { label: string; value: ReactNode; icon?: ReactNode; hint?: ReactNode; tone?: Tone }) {
  const accent = tone === "amber" ? "text-[#9a6400]" : tone === "red" ? "text-mark" : "text-slate-900";
  return (
    <div className="min-w-0 px-5 py-4">
      <p className="text-[13px] text-slate-500">{label}</p>
      <p className={cn("mt-1 font-display text-[32px] leading-none tabular", accent)}>{value}</p>
      {hint && <p className="mt-2 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function StatStrip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Card className={cn("grid divide-y divide-slate-200 sm:grid-flow-col sm:auto-cols-fr sm:divide-x sm:divide-y-0", className)}>
      {children}
    </Card>
  );
}

export function Progress({ value, className, tone = "brand" }: { value: number; className?: string; tone?: "brand" | "green" | "amber" | "red" }) {
  const c = { brand: "bg-slate-900", green: "bg-[#1e6b3a]", amber: "bg-[#d08700]", red: "bg-mark" }[tone];
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-slate-200", className)}>
      <div className={cn("h-full rounded-full transition-all duration-300", c)} style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }} />
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded-[3px] border border-b-2 border-slate-300 bg-white px-1 py-px font-mono text-[10.5px] text-slate-600">{children}</kbd>;
}

/* ---------- Modal ---------- */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  const w = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" }[size];
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/30 p-4 pt-[9vh]" onMouseDown={onClose}>
      <div className={cn("w-full rounded-lg border border-slate-300 bg-white shadow-pop", w)} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 px-6 pt-5">
          <div>
            <h2 className="font-display text-xl font-semibold text-slate-900">{title}</h2>
            {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
          </div>
          <button onClick={onClose} className="-mr-2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Đóng">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/* ---------- Confirm dialog (hook) ---------- */

type ConfirmOpts = { title: string; message?: ReactNode; confirmText?: string; danger?: boolean };
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<boolean>>(async () => false);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setState({ ...o, resolve })), []);
  const close = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Modal
        open={!!state}
        onClose={() => close(false)}
        title={state?.title}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => close(false)}>
              Hủy
            </Button>
            <Button variant={state?.danger ? "danger" : "primary"} onClick={() => close(true)} autoFocus>
              {state?.confirmText ?? "Đồng ý"}
            </Button>
          </>
        }
      >
        {state?.message && <div className="text-sm leading-relaxed text-slate-600">{state.message}</div>}
      </Modal>
    </ConfirmCtx.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmCtx);

/* ---------- Dropzone ---------- */

export function Dropzone({
  onFiles,
  accept,
  multiple = true,
  children,
  className,
}: {
  onFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => input.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length) onFiles(multiple ? files : files.slice(0, 1));
      }}
      className={cn(
        "cursor-pointer rounded-lg border border-dashed transition-colors focus-visible:outline-2 focus-visible:outline-slate-900",
        over ? "border-slate-900 bg-slate-100" : "border-slate-300 bg-white hover:border-slate-500",
        className,
      )}
    >
      <input
        ref={input}
        type="file"
        className="hidden"
        accept={accept}
        multiple={multiple}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onFiles(files);
          e.target.value = "";
        }}
      />
      {children}
    </div>
  );
}

/* ---------- Segmented control ---------- */

export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; className?: string }) {
  return (
    <div className={cn("inline-flex rounded-md border border-slate-300 bg-white p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-[4px] px-3 py-1 text-[13px] transition-colors [&_svg]:h-3.5 [&_svg]:w-3.5",
            value === o.value ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
