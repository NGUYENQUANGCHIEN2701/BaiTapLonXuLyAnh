import { api } from "./api";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  truncated?: boolean;
}

export interface ChatHealth { available: boolean; message: string }
export interface ChatReply { content: string; truncated: boolean }
const STORAGE_PREFIX = "omr:chat:";

export function clearChatHistory() {
  try {
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith(STORAGE_PREFIX)) sessionStorage.removeItem(key);
    }
  } catch { /* Trình duyệt có thể không cho phép lưu trữ. */ }
}

export function loadChatHistory(userId: number): ChatMessage[] {
  try {
    const data: unknown = JSON.parse(sessionStorage.getItem(`${STORAGE_PREFIX}${userId}`) ?? "[]");
    if (!Array.isArray(data) || data.length > 61) return [];
    if (!data.every((m, i) => m && typeof m.id === "string" &&
      m.role === (i % 2 === 0 ? "user" : "assistant") && typeof m.content === "string" &&
      m.content.trim().length > 0 && m.content.length <= (m.role === "user" ? 4000 : 16000))) return [];
    return data;
  } catch { return []; }
}

export function saveChatHistory(userId: number, messages: ChatMessage[]) {
  try {
    // Giữ cả cặp hỏi/đáp khi cắt lịch sử hiển thị.
    const start = Math.max(0, Math.ceil((messages.length - 61) / 2) * 2);
    sessionStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(messages.slice(start)));
  } catch { /* Chat vẫn dùng được khi storage bị chặn hoặc đầy. */ }
}

export function requestChat(messages: ChatMessage[], signal: AbortSignal) {
  let start = Math.max(0, messages.length - 19);
  if (start % 2) start++;
  let history = messages.slice(start);
  while (history.length > 1 && history.reduce((n, m) => n + m.content.length, 0) > 20000) {
    history = history.slice(2);
  }
  return api.post<ChatReply>("/api/chat/completions", {
    messages: history.map(({ role, content }) => ({ role, content })),
  }, signal);
}
