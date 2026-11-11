import { useQuery } from "@tanstack/react-query";
import { Bot, Check, Copy, Loader2, MessageCircle, Plus, RotateCw, Send, X } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { api, errMsg } from "../../lib/api";
import { loadChatHistory, requestChat, saveChatHistory, type ChatHealth, type ChatMessage } from "../../lib/chat";
import { cn } from "../../lib/utils";
import { Button, useConfirm } from "../ui";

const SUGGESTIONS = ["Hướng dẫn tạo kỳ thi", "Cách nhập đáp án", "Vì sao bài cần duyệt?", "Giải thích quy trình xử lý ảnh"];
// randomUUID chỉ có trong secure context; hỗ trợ cả điện thoại truy cập HTTP trong LAN.
const messageId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function Message({ message }: { message: ChatMessage }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <div className={cn("flex flex-col items-start gap-1.5", message.role === "user" && "items-end")}>
      <span className="px-1 text-[11px] font-medium text-slate-500">{message.role === "user" ? "Bạn" : "Trợ lý AI"}</span>
      <div className={cn("max-w-full rounded-xl px-3.5 py-3 text-[13px] leading-relaxed", message.role === "user"
        ? "max-w-[90%] whitespace-pre-wrap break-words rounded-tr-sm bg-slate-900 text-white"
        : "w-full rounded-tl-sm border border-slate-200 bg-white text-slate-800")}>
        {message.role === "user" ? message.content : (
          <div className="chat-markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={{
              a: ({ children, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer">{children}</a>,
              img: () => null,
              table: ({ children }) => <div className="overflow-x-auto"><table>{children}</table></div>,
            }}>{message.content}</ReactMarkdown>
          </div>
        )}
        {message.truncated && <p className="mt-3 border-t border-slate-200 pt-2 text-xs text-slate-500">Câu trả lời đã đạt giới hạn độ dài. Bạn có thể yêu cầu giải thích tiếp.</p>}
      </div>
      {message.role === "assistant" && (
        <button className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[11px] text-slate-500 hover:bg-slate-100 focus-visible:outline-2" onClick={async () => {
          try {
            await navigator.clipboard.writeText(message.content);
            setCopied(true);
            clearTimeout(timer.current);
            timer.current = setTimeout(() => setCopied(false), 2000);
          } catch { toast.error("Không thể sao chép. Bạn có thể chọn nội dung để sao chép thủ công."); }
        }} aria-label="Sao chép câu trả lời">
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}{copied ? "Đã sao chép" : "Sao chép"}
        </button>
      )}
    </div>
  );
}

export default function ChatWidget({ userId }: { userId: number }) {
  const [open, setOpen] = useState(false);
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
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
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
        aria-expanded={open} aria-controls="omr-chat" className={cn("fixed bottom-5 right-4 z-30 inline-flex h-12 items-center gap-2 rounded-full bg-slate-900 px-4 text-sm font-medium text-white shadow-pop transition-colors hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-4 sm:right-6", open && "hidden sm:inline-flex")}>
        <MessageCircle className="h-5 w-5" />Trợ lý AI
      </button>
      {open && (
        <section id="omr-chat" role="dialog" aria-label="Trợ lý AI OMR Exam" style={mobileStyle}
          className="fixed inset-x-2 bottom-2 z-40 flex h-[calc(100dvh-1rem)] flex-col overflow-hidden rounded-2xl border border-slate-300 bg-paper shadow-pop sm:inset-x-auto sm:bottom-20 sm:right-6 sm:h-[min(700px,calc(100dvh-7rem))] sm:w-[430px]">
          <header className="flex shrink-0 items-center gap-2.5 border-b border-slate-200 bg-white px-4 py-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-mark-soft text-mark"><Bot className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-lg font-semibold">Trợ lý AI</h2>
              <p className="flex items-center gap-1.5 text-[11px] text-slate-500" role="status">
                <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", checking && !health ? "bg-slate-400" : health?.available ? "bg-emerald-600" : "bg-amber-500")} />
                {checking && !health ? "Đang kiểm tra kết nối…" : health?.available ? "Đã kết nối dịch vụ AI" : "Chưa kết nối dịch vụ AI"}
              </p>
            </div>
            <Button size="icon" variant="ghost" title="Hội thoại mới" aria-label="Hội thoại mới" onClick={newConversation}><Plus /></Button>
            <Button size="icon" variant="ghost" title="Đóng chatbot" aria-label="Đóng chatbot" onClick={() => { setOpen(false); launcher.current?.focus(); }}><X /></Button>
          </header>

          <div ref={log} role="log" aria-label="Cuộc trò chuyện" aria-live="polite" aria-relevant="additions" className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-5">
            {!messages.length && (
              <div className="py-5">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-mark">OMR Exam · Trợ lý học tập</p>
                <h3 className="font-display text-[26px] font-semibold leading-tight">Tôi có thể giúp gì<br />cho bạn hôm nay?</h3>
                <p className="mt-3 text-[13px] leading-relaxed text-slate-600">Hỏi về cách sử dụng hệ thống, quy trình chấm thi hoặc kiến thức học tập.</p>
                <div className="mt-6 grid gap-2">
                  {SUGGESTIONS.map((text) => <button key={text} onClick={() => void send(text)} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-[13px] text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900 focus-visible:outline-2">{text}<span aria-hidden className="float-right text-slate-400">↗</span></button>)}
                </div>
              </div>
            )}
            {messages.map((message) => <Message key={message.id} message={message} />)}
            {busy && <div role="status" className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Đang trả lời…</div>}
            {!busy && pending && (
              <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
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
            {(!health?.available && !checking) && <div className="mb-2 flex items-start justify-between gap-2 text-[11px] leading-relaxed text-amber-800"><span>{health?.message ?? "Chưa kiểm tra được kết nối dịch vụ AI."}</span><button onClick={() => void checkHealth()} className="shrink-0 underline">Kiểm tra lại</button></div>}
            {historyNote && <p className="mb-2 text-[11px] text-slate-500">Trợ lý dùng các lượt trao đổi gần nhất để trả lời.</p>}
            <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="flex items-end gap-2 rounded-xl border border-slate-300 bg-paper p-2 focus-within:border-slate-600">
              <textarea ref={input} value={draft} onChange={(e) => setDraft(e.target.value)} rows={1} maxLength={4000}
                disabled={busy || pending} aria-label="Nội dung câu hỏi" placeholder="Nhập câu hỏi của bạn…"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); }
                }} className="min-h-9 min-w-0 flex-1 resize-none bg-transparent px-1 py-2 text-sm leading-5 outline-none disabled:opacity-50" />
              <Button type="submit" size="icon" aria-label="Gửi câu hỏi" disabled={!draft.trim() || busy || pending} className="mb-0.5 shrink-0 rounded-lg">{busy ? <Loader2 className="animate-spin" /> : <Send />}</Button>
            </form>
            <div className="mt-2 flex items-start justify-between gap-2 text-[10px] leading-relaxed text-slate-500"><p>AI có thể trả lời sai. Hãy kiểm tra thông tin quan trọng.</p><span className="shrink-0 tabular">{draft.length}/4000</span></div>
          </footer>
        </section>
      )}
    </>
  );
}
