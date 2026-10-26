import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, type ReactNode } from "react";
import { api } from "./api";
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
    const onUnauthorized = () => qc.setQueryData(["me"], null);
    window.addEventListener("omr:unauthorized", onUnauthorized);
    return () => window.removeEventListener("omr:unauthorized", onUnauthorized);
  }, [qc]);

  const value: AuthState = {
    user: isLoading ? undefined : (data ?? null),
    login: async (username, password) => {
      const u = await api.post<User>("/api/auth/login", { username, password });
      qc.clear();
      qc.setQueryData(["me"], u);
    },
    logout: async () => {
      await api.post("/api/auth/logout");
      qc.clear();
      qc.setQueryData(["me"], null);
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
