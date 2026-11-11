import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, type ReactNode } from "react";
import { api } from "./api";
import { clearChatHistory } from "./chat";
import type { User } from "./types";

interface AuthState {
  user: User | null | undefined; // undefined = đang tải
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthState>({ user: undefined, login: async () => {}, logout: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.get<User>("/api/auth/me").catch(() => null),
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    const onUnauthorized = () => { clearChatHistory(); qc.setQueryData(["me"], null); };
    window.addEventListener("omr:unauthorized", onUnauthorized);
    return () => window.removeEventListener("omr:unauthorized", onUnauthorized);
  }, [qc]);

  useEffect(() => { if (!isLoading && !data) clearChatHistory(); }, [data, isLoading]);

  const value: AuthState = {
    user: isLoading ? undefined : (data ?? null),
    login: async (username, password) => {
      const u = await api.post<User>("/api/auth/login", { username, password });
      clearChatHistory();
      // Không dùng qc.clear(): nó xóa luôn query "me" mà AuthProvider đang theo dõi,
      // khiến giao diện không biết đã đăng nhập. Chỉ bỏ dữ liệu của phiên trước.
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "me" });
      qc.setQueryData(["me"], u);
    },
    logout: async () => {
      await api.post("/api/auth/logout");
      clearChatHistory();
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "me" });
      qc.setQueryData(["me"], null);
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
