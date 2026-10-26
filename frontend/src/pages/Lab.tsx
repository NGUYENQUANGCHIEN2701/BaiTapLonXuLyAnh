import { Dices, FlaskConical, ImageUp, Maximize2, Timer } from "lucide-react";
import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { Badge, Button, Card, CardHeader, Dropzone, Empty, Field, Input, Modal, PageHeader, Spinner } from "../components/ui";
import { errMsg, upload } from "../lib/api";
import type { LabResult, LabStep } from "../lib/types";
import { cn, FLAG_LABEL } from "../lib/utils";

function ThresholdChart({ step }: { step: LabStep }) {
  const data = useMemo(() => (step.sorted_values ?? []).map((v, i) => ({ i, v })), [step.sorted_values]);
  return (
    <div className="h-64">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ left: -12, right: 12, top: 8 }}>
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2547ea" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#2547ea" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#eef2f7" />
          <XAxis dataKey="i" tick={{ fontSize: 11 }} label={{ value: "Thứ tự ô (đã sắp xếp)", position: "insideBottom", offset: -2, fontSize: 11 }} height={36} />
          <YAxis domain={[0, 255]} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v: number) => [v, "Độ sáng"]} labelFormatter={(l) => `Ô #${l}`} />
          <Area type="stepAfter" dataKey="v" stroke="#2547ea" fill="url(#g)" strokeWidth={2} isAnimationActive={false} />
          {step.threshold !== undefined && (
            <ReferenceLine y={step.threshold} stroke="#e11d48" strokeWidth={2} strokeDasharray="6 4" label={{ value: `Ngưỡng ${step.threshold}`, fill: "#e11d48", fontSize: 12, position: "insideTopLeft" }} />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function Lab() {
  const [result, setResult] = useState<LabResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [zoomImg, setZoomImg] = useState<LabStep | null>(null);
  const [nq, setNq] = useState(40);
  const [strength, setStrength] = useState(1);

  const analyze = async (file: File | Blob, name = "image.jpg") => {
    setBusy(true);
    setResult(null);
    setPreview(URL.createObjectURL(file));
    const fd = new FormData();
    fd.append("file", file, name);
    fd.append("num_questions", String(nq));
    try {
      const r = await upload<LabResult>("/api/lab/analyze", fd);
      setResult(r);
      if (!r.ok) toast.error(r.error ?? "Không xử lý được ảnh");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const sample = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/lab/sample?seed=${Math.floor(Math.random() * 1e6)}&strength=${strength}&questions=${nq}`, { credentials: "include" });
      if (!res.ok) throw new Error(`Lỗi ${res.status}`);
      await analyze(await res.blob(), "sample.jpg");
    } catch (e) {
      toast.error(errMsg(e));
      setBusy(false);
    }
  };

  const total = result?.steps.reduce((s, x) => s + x.ms, 0) ?? 0;
  const last = result?.steps.find((s) => s.key === "result");

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow={<span className="inline-flex items-center gap-1.5"><FlaskConical className="h-4 w-4" /> Minh họa thuật toán</span>}
        title="Phòng thí nghiệm xử lý ảnh"
        subtitle="Xem từng bước của pipeline OMR trên một ảnh bất kỳ — dùng cho báo cáo và thuyết trình. Ảnh không được lưu."
      />
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card className="p-4">
            <Dropzone accept="image/*,.pdf" multiple={false} onFiles={(f) => analyze(f[0], f[0].name)} className="p-6 text-center">
              <ImageUp className="mx-auto mb-2 h-8 w-8 text-brand-600" />
              <p className="text-sm font-medium text-slate-700">Chọn ảnh phiếu để phân tích</p>
              <p className="mt-1 text-xs text-slate-500">hoặc kéo thả vào đây</p>
            </Dropzone>
            <div className="my-4 flex items-center gap-3 text-xs text-slate-400">
              <div className="h-px flex-1 bg-slate-200" /> hoặc <div className="h-px flex-1 bg-slate-200" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Số câu" hint="Khi QR không đọc được">
                <Input type="number" min={1} max={120} value={nq} onChange={(e) => setNq(Math.max(1, Math.min(120, Number(e.target.value) || 1)))} />
              </Field>
              <Field label={`Độ khó ảnh: ${strength.toFixed(1)}`} hint="Nghiêng, bóng, mờ">
                <input type="range" min={0} max={1.6} step={0.1} value={strength} onChange={(e) => setStrength(Number(e.target.value))} className="mt-2 w-full accent-brand-600" />
              </Field>
            </div>
            <Button variant="secondary" className="mt-3 w-full" icon={<Dices className="h-4 w-4" />} onClick={sample} disabled={busy}>
              Sinh ảnh mẫu ngẫu nhiên
            </Button>
          </Card>
          {preview && (
            <Card className="overflow-hidden">
              <img src={preview} alt="" className="max-h-72 w-full object-contain bg-slate-100" />
            </Card>
          )}
          {result?.ok && last && (
            <Card className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-semibold text-slate-800">Kết quả đọc</span>
                <Badge tone="blue"><Timer className="h-3 w-3" /> {total.toFixed(0)} ms</Badge>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-slate-50 p-2.5">
                  <div className="text-xs text-slate-500">SBD</div>
                  <div className="font-mono text-lg font-semibold tracking-wider">{last.sbd}</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-2.5">
                  <div className="text-xs text-slate-500">Mã đề</div>
                  <div className="font-mono text-lg font-semibold tracking-wider">{last.exam_code}</div>
                </div>
              </div>
              <div className="mt-3 font-mono text-xs leading-relaxed text-slate-600 break-all">
                {last.answers?.map((a, i) => (
                  <span key={i} className={cn("mr-1.5 inline-block", !a && "text-slate-300", a && a.length > 1 && "font-bold text-amber-600")}>
                    {i + 1}.{a || "–"}
                  </span>
                ))}
              </div>
              {!!last.flags?.length && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {last.flags.map((f, i) => (
                    <Badge key={i} tone={f.kind === "warning" ? "gray" : "amber"}>{FLAG_LABEL[f.kind] ?? f.kind}: {f.field}</Badge>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>

        <div>
          {busy && (
            <Card className="flex h-64 items-center justify-center gap-3 text-slate-500">
              <Spinner /> Đang xử lý ảnh…
            </Card>
          )}
          {!busy && !result && (
            <Card>
              <Empty icon={<FlaskConical className="h-6 w-6" />} title="Chưa có ảnh"
                description="Tải lên một ảnh chụp phiếu trả lời (hoặc sinh ảnh mẫu) để xem lần lượt: chuyển xám → ước lượng nền → chuẩn hóa sáng → nhị phân → tìm marker → homography → căn chỉnh khối → đo độ sáng → chọn ngưỡng → kết quả." />
            </Card>
          )}
          {result && (
            <ol className="relative space-y-6 border-l-2 border-brand-100 pl-6">
              {result.steps.map((s, i) => (
                <li key={s.key} className="relative">
                  <span className="absolute -left-[37px] flex h-7 w-7 items-center justify-center rounded-full bg-brand-700 text-xs font-bold text-white ring-4 ring-slate-50">{i + 1}</span>
                  <Card>
                    <CardHeader
                      title={s.title}
                      subtitle={s.description}
                      actions={<Badge tone="gray"><Timer className="h-3 w-3" /> {s.ms} ms</Badge>}
                    />
                    {s.key === "threshold" && (
                      <div className="p-4">
                        <ThresholdChart step={s} />
                      </div>
                    )}
                    {s.key === "warped" && s.homography && (
                      <div className="border-b border-slate-100 px-5 py-3">
                        <div className="mb-1 text-xs font-medium text-slate-500">Ma trận homography H</div>
                        <table className="font-mono text-xs text-slate-700">
                          <tbody>
                            {s.homography.map((row, r) => (
                              <tr key={r}>
                                {row.map((v, c) => (
                                  <td key={c} className="px-2 py-0.5 text-right tabular">{v.toFixed(4)}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {s.key === "align_blocks" && s.shifts && (
                      <div className="flex flex-wrap gap-1.5 border-b border-slate-100 px-5 py-3">
                        {Object.entries(s.shifts).map(([k, [dx, dy, sc]]) => (
                          <Badge key={k} tone={sc > 0.4 ? "green" : sc > 0.25 ? "blue" : "gray"}>
                            {k}: ({dx >= 0 ? "+" : ""}{dx}, {dy >= 0 ? "+" : ""}{dy}) px · r={sc}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {s.image && (
                      <button className="group relative block w-full bg-slate-100 p-3" onClick={() => setZoomImg(s)}>
                        <img src={s.image} alt={s.title} className="mx-auto max-h-[520px] rounded shadow" />
                        <span className="absolute right-5 top-5 rounded-md bg-white/90 p-1.5 opacity-0 shadow group-hover:opacity-100">
                          <Maximize2 className="h-4 w-4" />
                        </span>
                      </button>
                    )}
                  </Card>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
      <Modal open={!!zoomImg} onClose={() => setZoomImg(null)} title={zoomImg?.title} size="xl">
        {zoomImg?.image && <img src={zoomImg.image} alt="" className="mx-auto max-h-[75vh]" />}
      </Modal>
    </div>
  );
}
