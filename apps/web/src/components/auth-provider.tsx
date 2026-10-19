"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { CurrentUser } from "@/lib/types";

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  refresh: () => Promise<CurrentUser | null>;
  login: (email: string, password: string) => Promise<CurrentUser | null>;
  register: (input: { fullName: string; email: string; password: string; accountType: "USER" | "PHARMACY" }) => Promise<CurrentUser | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Session state for the UI. This only drives what is shown — every permission
 * is enforced by the API regardless of what the browser believes.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const me = await api<CurrentUser>("/auth/me");
      setUser(me);
      return me;
    } catch (err) {
      if (!(err instanceof ApiError) || err.status !== 401) console.error(err);
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    api<CurrentUser>("/auth/me", { signal: controller.signal })
      .then(setUser)
      .catch((err: Error) => {
        if (err.name === "AbortError") return;
        if (!(err instanceof ApiError) || err.status !== 401) console.error(err);
        setUser(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      await api("/auth/login", { method: "POST", body: { email, password } });
      return refresh();
    },
    [refresh],
  );

  const register = useCallback<AuthContextValue["register"]>(
    async (input) => {
      await api("/auth/register", { method: "POST", body: input });
      return refresh();
    },
    [refresh],
  );

  const logout = useCallback(async () => {
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, refresh, login, register, logout }), [user, loading, refresh, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** Where a freshly logged-in account should land. */
export function homeFor(user: CurrentUser): string {
  if (user.role === "ADMIN") return "/admin";
  if (user.role === "PHARMACY_MANAGER") return "/dashboard";
  return "/dashboard/alerts";
}
