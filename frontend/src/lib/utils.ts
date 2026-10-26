import clsx, { type ClassValue } from "clsx";

export const cn = (...c: ClassValue[]) => clsx(c);

export function fmtScore(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return Number(v.toFixed(digits)).toLocaleString("vi-VN");
}

export function fmtPct(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined) return "—";
  return `${(v * 100).toLocaleString("vi-VN", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
}

export function fmtDate(s?: string | null): string {
  if (!s) return "";
  const d = new Date(s.endsWith("Z") || s.includes("+") ? s : s.replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });
}

export function timeAgo(s?: string | null): string {
  if (!s) return "";
  const d = new Date(s.endsWith("Z") || s.includes("+") ? s : s.replace(" ", "T") + "Z");
  const sec = Math.round((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return "vừa xong";
  if (sec < 3600) return `${Math.floor(sec / 60)} phút trước`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} giờ trước`;
  return `${Math.floor(sec / 86400)} ngày trước`;
}

export const STATUS_LABEL: Record<string, string> = {
  graded: "Đã chấm",
  review: "Cần xem lại",
  error: "Lỗi",
};

export const FLAG_LABEL: Record<string, string> = {
  blank: "Bỏ trống",
  multiple: "Tô nhiều ô",
  uncertain: "Tô mờ / tẩy",
  mismatch: "Không khớp",
  warning: "Cảnh báo",
  unknown_student: "Không rõ thí sinh",
  unknown_code: "Sai mã đề",
  no_key: "Chưa có đáp án",
  duplicate: "Trùng SBD",
  error: "Lỗi",
};

export function scoreColor(score: number | null | undefined, max = 10): string {
  if (score === null || score === undefined) return "text-slate-400";
  const r = score / max;
  if (r >= 0.8) return "text-[#1e6b3a]";
  if (r >= 0.5) return "text-slate-900";
  return "text-mark";
}

export function downloadUrl(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
