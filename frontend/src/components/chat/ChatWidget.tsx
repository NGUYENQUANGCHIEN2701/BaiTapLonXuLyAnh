import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Bot, Check, Copy, Loader2, Maximize2, MessageCircle, Minimize2, Plus, RotateCw, Send, UserRound, X } from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState, type CSSProperties } from "react";
import { toast } from "sonner";
import { api, errMsg } from "../../lib/api";
import { loadChatHistory, requestChat, saveChatHistory, type ChatHealth, type ChatMessage } from "../../lib/chat";
import { cn } from "../../lib/utils";
import { Button, useConfirm } from "../ui";

const ChatMarkdown = lazy(() => import("./ChatMarkdown"));
const SUGGESTIONS = [
  "Vì sao tổng ba góc trong một tam giác bằng 180°? Hãy giải thích dễ hiểu và cho ví dụ minh họa.",
  "Tế bào là gì? Vì sao tế bào được coi là đơn vị cơ bản của sự sống?",
  "Chuỗi thức ăn là gì? Hãy lấy ví dụ một chuỗi thức ăn đơn giản trong tự nhiên và giải thích vai trò của từng sinh vật.",
];
// randomUUID chỉ có trong secure context; hỗ trợ cả điện thoại truy cập HTTP trong LAN.
const messageId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function Message({ message }: { message: ChatMessage }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <article data-chat-role={message.role} className={cn("flex min-w-0 flex-col gap-2.5", message.role === "user" ? "items-end" : "items-start")}>
      <div className={cn("flex items-center gap-2 text-[14px] font-semibold", message.role === "user" ? "text-slate-600" : "text-primary-hover")}>
        {message.role === "user" ? <UserRound className="h-4 w-4" /> : <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-soft"><Bot className="h-4 w-4" /></span>}
        {message.role === "user" ? "Bạn" : "Trợ lý AI"}
      </div>
      <div className={cn("rounded-2xl px-5 py-4 text-[16px] leading-[1.85]", message.role === "user"
        ? "max-w-[90%] whitespace-pre-wrap break-words rounded-tr-sm bg-primary-hover text-white"
        : "w-full max-w-full rounded-tl-sm border border-border bg-white text-text shadow-sm")}>
        {message.role === "user" ? message.content : (
          <div className="chat-markdown">
            <Suspense fallback={<div className="whitespace-pre-wrap">{message.content}</div>}>
              <ChatMarkdown content={message.content} />
            </Suspense>
          </div>
        )}
        {message.truncated && <p className="mt-3 border-t border-slate-200 pt-2 text-[13px] text-slate-500">Câu trả lời đã đạt giới hạn độ dài. Bạn có thể yêu cầu giải thích tiếp.</p>}
      </div>
      {message.role === "assistant" && (
        <button className="inline-flex min-h-9 items-center gap-2 rounded-lg px-2 py-1 text-[13px] font-medium text-slate-600 hover:bg-primary-soft hover:text-primary-hover focus-visible:outline-2" onClick={async () => {
          try {
            await navigator.clipboard.writeText(message.content);
            setCopied(true);
            clearTimeout(timer.current);
            timer.current = setTimeout(() => setCopied(false), 2000);
          } catch { toast.error("Không thể sao chép. Bạn có thể chọn nội dung để sao chép thủ công."); }
        }} aria-label="Sao chép câu trả lời">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? "Đã sao chép" : "Sao chép"}
        </button>
      )}
    </article>
  );
}

export default function ChatWidget({ userId }: { userId: number }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadChatHistory(userId));
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mobileStyle, setMobileStyle] = useState<CSSProperties>();
  const [historyNote, setHistoryNote] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const confirm = useConfirm();
  const pending = messages.at(-1)?.role === "user";
  const { data: health, isFetching: checking, refetch: checkHealth } = useQuery({
    queryKey: ["chat-health", userId],
    queryFn: () => api.get<ChatHealth>("/api/chat/health"),
    enabled: open, retry: false, staleTime: 30000, refetchInterval: open ? 30000 : false,
  });

  useEffect(() => { saveChatHistory(userId, messages); }, [messages, userId]);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); launcher.current?.focus(); }
    };
    const resize = () => {
      const viewport = window.visualViewport;
      setMobileStyle(window.innerWidth < 640 ? { top: (viewport?.offsetTop ?? 0) + 8,
        height: (viewport?.height ?? window.innerHeight) - 16, bottom: "auto" } : undefined);
    };
    resize();
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("scroll", resize);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("scroll", resize);
    };
  }, [open]);
  useEffect(() => {
    const container = log.current;
    if (!container || !open) return;
    const lastReply = container.querySelector<HTMLElement>('[data-chat-role="assistant"]:last-of-type');
    if (messages.at(-1)?.role === "assistant" && lastReply) {
      // Show the start of a long answer so the reader can follow it from the beginning.
      container.scrollTop += lastReply.getBoundingClientRect().top - container.getBoundingClientRect().top - 20;
    } else container.scrollTop = container.scrollHeight;
  }, [messages, busy, error, open]);
  useEffect(() => {
    if (input.current) {
      input.current.style.height = "auto";
      input.current.style.height = `${Math.min(input.current.scrollHeight, 128)}px`;
    }
  }, [draft, open]);

  async function send(question?: string, retry = false) {
    if (controller.current) return;
    const content = (question ?? draft).trim();
    if ((!content || content.length > 4000 || pending) && !retry) return;
    const history = retry ? messages : [...messages, { id: messageId(), role: "user" as const, content }];
    if (!history.length || history.at(-1)?.role !== "user") return;
    const request = new AbortController();
    controller.current = request;
    setMessages(history);
    setDraft("");
    setError("");
    setBusy(true);
    // Một khoảng chờ hữu hạn ngay cả khi reverse proxy không phản hồi.
    const timeout = setTimeout(() => request.abort(), 120000);
    try {
      const reply = await requestChat(history, request.signal);
      if (!request.signal.aborted) {
        setMessages([...history, { id: messageId(), role: "assistant", content: reply.content, truncated: reply.truncated }]);
        setHistoryNote(history.length >= 19 || history.reduce((n, m) => n + m.content.length, 0) > 20000);
        void checkHealth();
      }
    } catch (cause) {
      if (controller.current === request) setError(request.signal.aborted
        ? "Yêu cầu đã hết thời gian chờ. Vui lòng thử lại." : cause instanceof TypeError
          ? "Mất kết nối tới máy chủ. Vui lòng kiểm tra mạng và thử lại." : errMsg(cause));
    } finally {
      clearTimeout(timeout);
      if (controller.current === request) { controller.current = null; setBusy(false); }
    }
  }

  async function newConversation() {
    if (messages.length && !await confirm({ title: "Bắt đầu hội thoại mới?", message: "Nội dung cuộc trò chuyện hiện tại sẽ được xóa khỏi tab này.", confirmText: "Hội thoại mới" })) return;
    controller.current?.abort();
    controller.current = null;
    setBusy(false); setMessages([]); setDraft(""); setError(""); setHistoryNote(false);
    input.current?.focus();
  }

  return (
    <>
      <button ref={launcher} onClick={() => setOpen(!open)} aria-label={open ? "Thu gọn trợ lý AI" : "Mở trợ lý AI"}
        aria-expanded={open} aria-controls="omr-chat" className={cn("fixed bottom-5 right-4 z-30 inline-flex h-12 items-center gap-2 rounded-full border border-primary bg-white px-4 text-[15px] font-semibold text-primary-hover shadow-sm transition-colors hover:bg-primary-softer active:bg-primary-soft focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-4 sm:right-6", open && "hidden sm:inline-flex")}>
        <MessageCircle className="h-5 w-5" />Trợ lý AI
      </button>
      {open && (
        <section id="omr-chat" role="dialog" aria-label="Trợ lý AI OMR Exam" style={mobileStyle}
          className={cn("fixed inset-x-2 bottom-2 z-40 flex h-[calc(100dvh-1rem)] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-md sm:inset-x-auto sm:right-6", expanded
            ? "sm:bottom-6 sm:h-[calc(100dvh-3rem)] sm:w-[min(900px,calc(100vw-3rem))]"
            : "sm:bottom-20 sm:h-[min(780px,calc(100dvh-7rem))] sm:w-[min(520px,calc(100vw-3rem))]")}>
          <header className="flex shrink-0 items-center gap-2.5 border-b border-border bg-white px-4 py-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"><Bot className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1">
              <h2 className="font-sans text-lg font-semibold">Trợ lý AI</h2>
              <p className="flex items-center gap-1.5 text-[13px] text-slate-500" role="status">
                <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", checking && !health ? "bg-slate-400" : health?.available ? "bg-emerald-600" : "bg-amber-500")} />
                {checking && !health ? "Đang kiểm tra kết nối…" : health?.available ? "Đã kết nối dịch vụ AI" : "Chưa kết nối dịch vụ AI"}
              </p>
            </div>
            <Button size="icon" variant="ghost" title="Hội thoại mới" aria-label="Hội thoại mới" onClick={newConversation}><Plus /></Button>
            <div className="hidden sm:block"><Button size="icon" variant="ghost" title={expanded ? "Thu nhỏ khung chat" : "Phóng to khung chat"} aria-label={expanded ? "Thu nhỏ khung chat" : "Phóng to khung chat"} aria-pressed={expanded} onClick={() => setExpanded((value) => !value)}>{expanded ? <Minimize2 /> : <Maximize2 />}</Button></div>
            <Button size="icon" variant="ghost" title="Đóng chatbot" aria-label="Đóng chatbot" onClick={() => { setOpen(false); launcher.current?.focus(); }}><X /></Button>
          </header>

          <div ref={log} role="log" aria-label="Cuộc trò chuyện" aria-live="polite" aria-relevant="additions" className="min-h-0 flex-1 space-y-7 overflow-y-auto overscroll-contain px-4 py-5 sm:px-5">
            {!messages.length && (
              <div className="py-5">
                <p className="mb-2 text-[13px] font-semibold text-primary-hover">OMR Exam · Trợ lý học tập</p>
                <h3 className="font-sans text-2xl font-semibold leading-tight text-navy">Tôi có thể giúp gì<br />cho bạn hôm nay?</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-text-muted">Hỏi về cách sử dụng hệ thống, quy trình chấm thi hoặc kiến thức học tập.</p>
                <div className="mt-6 grid gap-2">
                  {SUGGESTIONS.map((text) => <button key={text} onClick={() => void send(text)} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-white px-3 py-3 text-left text-[15px] text-text transition-colors hover:border-primary hover:bg-primary-softer hover:text-primary-hover focus-visible:outline-2"><span className="min-w-0 flex-1 break-words">{text}</span><ArrowUpRight aria-hidden className="mt-1 h-[18px] w-[18px] shrink-0 text-primary" /></button>)}
                </div>
              </div>
            )}
            {messages.map((message) => <Message key={message.id} message={message} />)}
            {busy && <div role="status" className="flex items-center gap-2 text-[13px] text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Đang trả lời…</div>}
            {!busy && pending && (
              <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[13px] leading-relaxed text-amber-800">
                <p>{error || "Câu hỏi này chưa có câu trả lời. Bạn có thể thử gửi lại."}</p>
                <div className="mt-2 flex flex-wrap gap-3">
                  <button className="inline-flex items-center gap-1 font-medium underline underline-offset-2" onClick={() => void send(undefined, true)}><RotateCw className="h-3 w-3" />Thử lại</button>
                  <button className="underline underline-offset-2" onClick={() => {
                    setDraft(messages.at(-1)?.content ?? ""); setMessages(messages.slice(0, -1)); setError(""); input.current?.focus();
                  }}>Sửa câu hỏi</button>
                </div>
              </div>
            )}
          </div>

          <footer className="shrink-0 border-t border-slate-200 bg-white px-3 pb-3 pt-2.5">
            {(!health?.available && !checking) && <div className="mb-2 flex items-start justify-between gap-2 text-[13px] leading-relaxed text-amber-800"><span>{health?.message ?? "Chưa kiểm tra được kết nối dịch vụ AI."}</span><button onClick={() => void checkHealth()} className="shrink-0 underline">Kiểm tra lại</button></div>}
            {historyNote && <p className="mb-2 text-[13px] text-slate-500">Trợ lý dùng các lượt trao đổi gần nhất để trả lời.</p>}
            <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="flex items-end gap-2 rounded-xl border border-border bg-white p-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
              <textarea ref={input} value={draft} onChange={(e) => setDraft(e.target.value)} rows={1} maxLength={4000}
                disabled={busy || pending} aria-label="Nội dung câu hỏi" placeholder="Nhập câu hỏi của bạn…"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); }
                }} className="min-h-9 min-w-0 flex-1 resize-none bg-transparent px-1 py-2 text-[16px] leading-6 outline-none disabled:opacity-50" />
              <Button type="submit" variant="secondary" size="icon" aria-label="Gửi câu hỏi" disabled={!draft.trim() || busy || pending} className="mb-0.5 shrink-0 rounded-lg">{busy ? <Loader2 className="animate-spin" /> : <Send />}</Button>
            </form>
            <p className="mt-2 text-right text-[13px] leading-relaxed text-text-muted tabular">{draft.length}/4000</p>
          </footer>
        </section>
      )}
    </>
  );
}
