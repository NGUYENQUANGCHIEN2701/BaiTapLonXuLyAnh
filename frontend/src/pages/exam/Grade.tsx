import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Camera, CheckCircle2, FileImage, Loader2, Upload, XCircle } from "lucide-react";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Badge, Button, Card, CardHeader, Dropzone, Progress, Segmented, StatusBadge } from "../../components/ui";
import { api, errMsg, upload } from "../../lib/api";
import type { Exam, SubmissionBrief } from "../../lib/types";
import { cn, fmtScore, scoreColor } from "../../lib/utils";
import { useExam } from "./ExamLayout";

type QItem = { id: number; file: File; state: "pending" | "uploading" | "done" | "error"; progress: number; results?: SubmissionBrief[]; error?: string };

function ResultLine({ s, exam }: { s: SubmissionBrief; exam: Exam }) {
  return (
    <Link to={`/submissions/${s.id}`} className="flex flex-wrap items-center gap-3 rounded-lg px-2 py-2 text-[15px] hover:bg-primary-softer">
      <span className="font-sans tabular text-slate-700">{s.sbd || "??????"}</span>
      <span className="truncate text-slate-600">{s.student_name || (s.status === "error" ? s.error : "—")}</span>
      <span className="text-[13px] text-text-muted">mã {s.exam_code || "?"}</span>
      <span className={cn("ml-auto font-semibold tabular", scoreColor(s.score, exam.max_score))}>{fmtScore(s.score)}</span>
      <StatusBadge status={s.status} />
    </Link>
  );
}

function UploadMode({ exam }: { exam: Exam }) {
  const qc = useQueryClient();
  // Hàng đợi giữ trong ref (nguồn sự thật), state chỉ để vẽ lại giao diện
  const items = useRef<QItem[]>([]);
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  const running = useRef(0);
  const nextId = useRef(1);
  const queue = items.current;

  const update = (id: number, patch: Partial<QItem>) => {
    items.current = items.current.map((it) => (it.id === id ? { ...it, ...patch } : it));
    rerender();
  };

  const pump = () => {
    while (running.current < 3) {
      const it = items.current.find((i) => i.state === "pending");
      if (!it) break;
      running.current++;
      update(it.id, { state: "uploading" });
      const fd = new FormData();
      fd.append("files", it.file);
      upload<SubmissionBrief[]>(`/api/exams/${exam.id}/submissions`, fd, (p) => update(it.id, { progress: p }))
        .then((results) => update(it.id, { state: "done", results, progress: 1 }))
        .catch((e) => update(it.id, { state: "error", error: errMsg(e) }))
        .finally(() => {
          running.current--;
          pump();
          if (!items.current.some((x) => x.state === "pending" || x.state === "uploading")) {
            qc.invalidateQueries({ queryKey: ["exam", exam.id] });
            qc.invalidateQueries({ queryKey: ["submissions", exam.id] });
            qc.invalidateQueries({ queryKey: ["exams"] });
          }
        });
    }
  };

  const add = (files: File[]) => {
    const fresh: QItem[] = files.map((file) => ({ id: nextId.current++, file, state: "pending", progress: 0 }));
    items.current = [...fresh.reverse(), ...items.current];
    rerender();
    pump();
  };

  const clearFinished = () => {
    items.current = items.current.filter((i) => i.state === "pending" || i.state === "uploading");
    rerender();
  };

  const done = queue.filter((q) => q.state === "done" || q.state === "error").length;
  const results = queue.flatMap((q) => q.results ?? []);
  const nReview = results.filter((r) => r.status === "review").length;
  const nErr = results.filter((r) => r.status === "error").length + queue.filter((q) => q.state === "error").length;

  return (
    <div className="space-y-6">
      <Dropzone accept="image/*,.pdf" onFiles={add} className="px-6 py-12 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center text-slate-500">
          <Upload className="h-6 w-6" />
        </div>
        <p className="font-medium text-slate-800">Kéo thả ảnh phiếu vào đây, hoặc bấm để chọn</p>
        <p className="mt-1 text-[15px] text-slate-500">JPG, PNG, PDF quét nhiều trang · chọn nhiều file cùng lúc · trên điện thoại có thể chụp trực tiếp</p>
      </Dropzone>

      {queue.length > 0 && (
        <Card>
          <CardHeader
            title={`Hàng đợi chấm (${done}/${queue.length})`}
            subtitle={
              <span className="flex flex-wrap gap-2">
                <Badge tone="green">{results.length - nReview - nErr} đã chấm</Badge>
                {nReview > 0 && <Badge tone="amber">{nReview} cần xem lại</Badge>}
                {nErr > 0 && <Badge tone="red">{nErr} lỗi</Badge>}
              </span>
            }
            actions={
              <>
                {nReview > 0 && done === queue.length && (
                  <Link to="../results?status=review">
                    <Button size="sm" variant="outline" icon={<AlertTriangle className="h-4 w-4" />}>Duyệt bài cần xem lại</Button>
                  </Link>
                )}
                <Button size="sm" variant="ghost" onClick={clearFinished}>
                  Xóa danh sách
                </Button>
              </>
            }
          />
          <div className="px-5 pt-3">
            <Progress value={queue.length ? done / queue.length : 0} />
          </div>
          <ul className="max-h-[520px] divide-y divide-border overflow-y-auto p-2">
            {queue.map((it) => (
              <li key={it.id} className="px-3 py-2.5">
                <div className="flex items-center gap-3">
                  {it.state === "done" ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                  ) : it.state === "error" ? (
                    <XCircle className="h-5 w-5 shrink-0 text-rose-500" />
                  ) : it.state === "uploading" ? (
                    <Loader2 className="h-5 w-5 shrink-0 animate-spin text-slate-500" />
                  ) : (
                    <FileImage className="h-5 w-5 shrink-0 text-text-muted" />
                  )}
                  <span className="truncate text-[15px] font-medium text-slate-700">{it.file.name}</span>
                  <span className="ml-auto shrink-0 text-[13px] text-text-muted">{(it.file.size / 1024 / 1024).toFixed(1)} MB</span>
                </div>
                {it.state === "uploading" && <Progress value={it.progress < 1 ? it.progress * 0.8 : 0.9} className="ml-8 mt-2 h-1.5 w-auto" />}
                {it.error && <p className="ml-8 mt-1 text-[15px] text-rose-600">{it.error}</p>}
                {it.results && (
                  <div className="ml-6 mt-1">
                    {it.results.map((s) => (
                      <ResultLine key={s.id} s={s} exam={exam} />
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function WebcamMode({ exam }: { exam: Exam }) {
  const qc = useQueryClient();
  const video = useRef<HTMLVideoElement>(null);
  const overlay = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string>("");
  const [auto, setAuto] = useState(true);
  const [detected, setDetected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<SubmissionBrief[]>([]);
  const [error, setError] = useState("");
  const stable = useRef(0);
  const cooldown = useRef(0);
  const busyRef = useRef(false);

  const start = async (id?: string) => {
    setError("");
    try {
      stream?.getTracks().forEach((t) => t.stop());
      const s = await navigator.mediaDevices.getUserMedia({
        video: id ? { deviceId: { exact: id }, width: { ideal: 1920 }, height: { ideal: 1080 } } : { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      setStream(s);
      if (video.current) video.current.srcObject = s;
      const all = await navigator.mediaDevices.enumerateDevices();
      setDevices(all.filter((d) => d.kind === "videoinput"));
    } catch (e) {
      setError(
        window.isSecureContext
          ? `Không mở được camera: ${errMsg(e)}`
          : "Trình duyệt chỉ cho phép camera trên https hoặc localhost. Trên điện thoại, hãy dùng chế độ Tải ảnh lên (có nút chụp ảnh).",
      );
    }
  };

  useEffect(() => () => stream?.getTracks().forEach((t) => t.stop()), [stream]);

  const grab = (maxSide: number): Promise<Blob | null> => {
    const v = video.current;
    if (!v || !v.videoWidth) return Promise.resolve(null);
    const s = Math.min(1, maxSide / Math.max(v.videoWidth, v.videoHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(v.videoWidth * s);
    c.height = Math.round(v.videoHeight * s);
    c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height);
    return new Promise((r) => c.toBlob(r, "image/jpeg", 0.9));
  };

  const capture = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const blob = await grab(2400);
      if (!blob) return;
      const fd = new FormData();
      fd.append("files", new File([blob], `webcam_${Date.now()}.jpg`, { type: "image/jpeg" }));
      const res = await upload<SubmissionBrief[]>(`/api/exams/${exam.id}/submissions`, fd);
      setLast((l) => [...res, ...l].slice(0, 12));
      const s = res[0];
      if (s?.status === "error") toast.error(s.error || "Không chấm được");
      else toast.success(`SBD ${s.sbd}: ${fmtScore(s.score)} điểm${s.status === "review" ? " (cần xem lại)" : ""}`);
      qc.invalidateQueries({ queryKey: ["exam", exam.id] });
      qc.invalidateQueries({ queryKey: ["submissions", exam.id] });
      cooldown.current = Date.now() + 3500;
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [exam.id, qc]);

  // vòng lặp phát hiện marker ~3 lần/giây
  useEffect(() => {
    if (!stream) return;
    let alive = true;
    const loop = async () => {
      while (alive) {
        const t0 = Date.now();
        try {
          const blob = await grab(720);
          if (blob && !busyRef.current) {
            const fd = new FormData();
            fd.append("file", blob, "f.jpg");
            const r = await api.post<{ ok: boolean; markers: [number, number][] }>("/api/lab/detect", fd);
            drawOverlay(r.ok ? r.markers : []);
            setDetected(r.ok);
            stable.current = r.ok ? stable.current + 1 : 0;
            if (auto && r.ok && stable.current >= 3 && Date.now() > cooldown.current) {
              stable.current = 0;
              await capture();
            }
          }
        } catch {
          /* bỏ qua khung lỗi */
        }
        await new Promise((r) => setTimeout(r, Math.max(0, 330 - (Date.now() - t0))));
      }
    };
    loop();
    return () => {
      alive = false;
    };
  }, [stream, auto, capture]);

  const drawOverlay = (pts: [number, number][]) => {
    const c = overlay.current;
    const v = video.current;
    if (!c || !v) return;
    c.width = v.clientWidth;
    c.height = v.clientHeight;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    if (pts.length !== 4) return;
    // video dùng object-contain -> tính vùng hiển thị thực
    const vr = v.videoWidth / v.videoHeight;
    const cr = c.width / c.height;
    const w = vr > cr ? c.width : c.height * vr;
    const h = vr > cr ? c.width / vr : c.height;
    const ox = (c.width - w) / 2;
    const oy = (c.height - h) / 2;
    const colors = getComputedStyle(document.documentElement);
    ctx.strokeStyle = colors.getPropertyValue("--color-success");
    ctx.lineWidth = 4;
    ctx.fillStyle = colors.getPropertyValue("--color-success");
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(ox + x * w, oy + y * h) : ctx.moveTo(ox + x * w, oy + y * h)));
    ctx.closePath();
    ctx.globalAlpha = 0.12;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.stroke();
    pts.forEach(([x, y], i) => {
      ctx.fillStyle = colors.getPropertyValue(i === 0 ? "--color-danger" : "--color-success");
      ctx.beginPath();
      ctx.arc(ox + x * w, oy + y * h, 8, 0, Math.PI * 2);
      ctx.fill();
    });
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <Card className="overflow-hidden">
        <div className="relative aspect-video min-h-[320px] bg-surface sm:min-h-0">
          <video ref={video} autoPlay playsInline muted className="h-full w-full object-contain" />
          <canvas ref={overlay} className="pointer-events-none absolute inset-0 h-full w-full" />
          {!stream && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-5 text-center text-text-muted">
              <Camera className="h-10 w-10" />
              <p className="max-w-sm text-[15px]">Đặt phiếu trước camera — hệ thống tự nhận 4 marker và chấm khi phiếu đứng yên.</p>
              <Button onClick={() => start()} icon={<Camera className="h-4 w-4" />}>Bật camera</Button>
              {error && <p className="max-w-md text-[15px] text-rose-300">{error}</p>}
            </div>
          )}
          {stream && (
            <div className="absolute left-3 top-3 flex gap-2">
              <Badge tone={detected ? "green" : "gray"} dot>{detected ? "Đã thấy phiếu" : "Đang tìm phiếu…"}</Badge>
              {busy && <Badge tone="blue">Đang chấm…</Badge>}
            </div>
          )}
          {stream && detected && !busy && <div className="scan-line pointer-events-none absolute left-0 right-0 h-0.5 bg-success" />}
        </div>
        {stream && (
          <div className="flex flex-wrap items-center gap-3 border-t border-border p-3">
            <Button onClick={capture} loading={busy} icon={<Camera className="h-4 w-4" />}>Chụp & chấm</Button>
            <label className="flex items-center gap-2 text-[15px] text-slate-600">
              <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Tự động chụp khi phát hiện phiếu
            </label>
            {devices.length > 1 && (
              <select
                className="ml-auto h-9 rounded-lg px-2 text-[15px] ring-1 ring-slate-300"
                value={deviceId}
                onChange={(e) => {
                  setDeviceId(e.target.value);
                  start(e.target.value);
                }}
              >
                <option value="">Camera mặc định</option>
                {devices.map((d, i) => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${i + 1}`}</option>
                ))}
              </select>
            )}
          </div>
        )}
      </Card>
      <Card>
        <CardHeader title="Vừa chấm" subtitle="Bấm để xem chi tiết / sửa" />
        <div className="p-2">
          {!last.length && <p className="px-3 py-6 text-center text-[15px] text-slate-500">Chưa có bài nào.</p>}
          {last.map((s) => (
            <ResultLine key={s.id} s={s} exam={exam} />
          ))}
        </div>
      </Card>
    </div>
  );
}

export default function Grade() {
  const exam = useExam();
  const [mode, setMode] = useState<"upload" | "webcam">("upload");
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: "upload", label: <span className="flex items-center gap-1.5"><Upload className="h-3.5 w-3.5" /> Tải ảnh lên</span> },
            { value: "webcam", label: <span className="flex items-center gap-1.5"><Camera className="h-3.5 w-3.5" /> Webcam / Camera</span> },
          ]}
        />
        {exam.num_keys === 0 && (
          <Badge tone="amber">
            <AlertTriangle className="h-3.5 w-3.5" /> Chưa có đáp án — bài vẫn được đọc, sẽ tính điểm khi nhập đáp án
          </Badge>
        )}
      </div>
      {mode === "upload" ? <UploadMode exam={exam} /> : <WebcamMode exam={exam} />}
    </div>
  );
}
