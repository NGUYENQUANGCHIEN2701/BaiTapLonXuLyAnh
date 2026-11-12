import { BarChart3, FolderOpen, Loader2, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
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
  primary: "bg-primary text-white hover:bg-primary-hover active:bg-primary-hover",
  secondary: "border border-primary bg-white text-primary-hover hover:bg-primary-softer active:bg-primary-soft",
  outline: "border border-primary bg-white text-primary-hover hover:bg-primary-softer active:bg-primary-soft",
  ghost: "text-slate-500 hover:bg-primary-softer hover:text-primary-hover active:bg-primary-soft active:text-primary-hover",
  danger: "border border-danger bg-danger text-white hover:bg-danger-soft hover:text-text active:bg-danger-soft active:text-text",
  success: "bg-primary text-white hover:bg-primary-hover active:bg-primary-hover",
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
    sm: "min-h-9 px-3 py-1.5 gap-1.5",
    md: "min-h-11 px-4 py-2.5 gap-2",
    lg: "min-h-12 px-5 py-3 gap-2",
    icon: "h-10 w-10 shrink-0 justify-center",
  };
  return (
    <button
      className={cn(
        "ui-button inline-flex items-center justify-center whitespace-normal rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:h-[18px] [&_svg]:w-[18px]",
        variant === "primary" || variant === "success" ? "text-[19px] font-bold" : "text-[15px] font-semibold",
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
    <div className={cn("ui-card min-w-0 rounded-xl border border-border bg-white shadow-sm", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, actions, className }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-4 border-b border-border p-5 sm:px-6", className)}>
      <div className="min-w-0">
        <h3 className="text-lg font-semibold text-navy">{title}</h3>
        {subtitle && <p className="mt-0.5 text-[13px] text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ---------- Badge ---------- */

const TONES = {
  gray: "bg-surface text-text-muted",
  blue: "bg-primary-soft text-primary-hover",
  green: "bg-success-soft text-[#116B3B] before:bg-success",
  amber: "bg-warning-soft text-[#914600] before:bg-warning",
  red: "bg-danger-soft text-[#B42318] before:bg-danger",
  violet: "bg-violet-50 text-violet-700",
};
export type Tone = keyof typeof TONES;

export function Badge({ tone = "gray", children, className }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-medium leading-4 whitespace-nowrap [&_svg]:h-3.5 [&_svg]:w-3.5", TONES[tone], ["green", "amber", "red"].includes(tone) && "before:h-1.5 before:w-1.5 before:rounded-full before:content-['']", className)}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-[13px] text-text-muted">Chưa nộp</span>;
  const map: Record<string, [string, string]> = {
    graded: ["bg-success-soft text-[#116B3B] before:bg-success", "Đã chấm"],
    review: ["bg-warning-soft text-[#914600] before:bg-warning", "Cần xem lại"],
    error: ["bg-danger-soft text-[#B42318] before:bg-danger", "Lỗi"],
  };
  const [c, label] = map[status] ?? ["bg-surface before:bg-text-muted", status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 whitespace-nowrap text-[13px] font-medium text-text before:h-1.5 before:w-1.5 before:rounded-full before:content-['']", c)}>
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
      {hint && !error && <span className="mt-1 block text-[13px] text-slate-500">{hint}</span>}
      {error && <span className="mt-1 block text-[15px] text-danger">{error}</span>}
    </label>
  );
}

const inputCls =
  "block w-full min-w-0 rounded-lg border border-border bg-white px-3.5 py-2.5 text-[15px] text-text placeholder:text-text-muted outline-none transition-colors duration-150 hover:border-primary focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-surface disabled:text-text-muted aria-invalid:border-danger";

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputCls, "min-h-11", className)} {...rest} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputCls, className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(inputCls, "min-h-11 pr-8", className)} {...rest}>
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
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft text-primary [&_svg]:h-8 [&_svg]:w-8">{icon ?? <FolderOpen />}</div>
      <h3 className="text-xl font-semibold text-navy">{title}</h3>
      {description && <p className="mt-1.5 max-w-md text-[15px] leading-relaxed text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5 text-[13px] text-slate-500">{eyebrow}</div>}
        <h1 className="text-[32px] font-bold leading-tight text-navy sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Thẻ thống kê dùng chung cho dashboard và các báo cáo. */
export function StatCard({ label, value, icon, hint, tone }: { label: string; value: ReactNode; icon?: ReactNode; hint?: ReactNode; tone?: Tone }) {
  const accent = "text-navy";
  return (
    <Card className={cn("p-5", tone === "amber" && "border-warning", tone === "red" && "border-danger")}>
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary [&_svg]:h-5 [&_svg]:w-5">{icon ?? <BarChart3 />}</div>
      <p className="text-[13px] text-text-muted">{label}</p>
      <p className={cn("mt-2 break-words text-[30px] font-bold leading-tight tabular", accent)}>{value}</p>
      {hint && <p className="mt-2 text-[13px] leading-relaxed text-text-muted">{hint}</p>}
    </Card>
  );
}

export function StatStrip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("grid grid-cols-1 gap-4 min-[375px]:grid-cols-2 xl:auto-cols-fr xl:grid-flow-col xl:grid-cols-none", className)}>
      {children}
    </div>
  );
}

export function Progress({ value, className, tone = "brand" }: { value: number; className?: string; tone?: "brand" | "green" | "amber" | "red" }) {
  const c = { brand: "bg-primary", green: "bg-success", amber: "bg-warning", red: "bg-danger" }[tone];
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-slate-200", className)}>
      <div className={cn("h-full rounded-full transition-all duration-300", c)} style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }} />
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded-[3px] border border-b-2 border-slate-300 bg-white px-1 py-px font-sans text-[13px] text-slate-600">{children}</kbd>;
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
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  const w = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" }[size];
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy/40 p-4 pt-[6vh]" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className={cn("w-full min-w-0 rounded-2xl border border-border bg-white shadow-md", w)} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 px-6 pt-5">
          <div>
            <h2 id={titleId} className="text-2xl font-semibold text-navy">{title}</h2>
            {description && <p className="mt-1 text-[15px] text-slate-500">{description}</p>}
          </div>
          <button onClick={onClose} className="-mr-2 rounded p-1 text-text-muted hover:bg-primary-softer hover:text-slate-700" aria-label="Đóng">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 py-6">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-3 border-t border-border px-6 py-4">{footer}</div>}
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
        {state?.message && <div className="text-[15px] leading-relaxed text-slate-600">{state.message}</div>}
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
        "cursor-pointer rounded-xl border-2 border-dashed transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:bg-primary-soft [&_svg]:text-primary",
        over ? "border-primary bg-primary-soft" : "border-border bg-white hover:border-primary hover:bg-primary-softer",
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
    <div className={cn("inline-flex max-w-full flex-wrap gap-1 rounded-xl border border-border bg-surface p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "min-h-9 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors duration-150 [&_svg]:h-4 [&_svg]:w-4",
            value === o.value ? "bg-primary-soft font-semibold text-primary-hover" : "text-text-muted hover:bg-primary-softer hover:text-primary-hover",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
