"use client";

import { create } from "zustand";

import { configureApiClient } from "@/shared/api/client";
import { authService } from "@/shared/api/services/auth.service";
import type { AuthResponse, LoginRequest, LogoutRequest, RegisterRequest } from "@/shared/types/auth";
import { clearAuthHintCookie, setAuthHintCookie } from "@/features/auth/lib/hint-cookie";

type AuthStore = {
  user: AuthResponse["user"] | null;
  session: AuthResponse["session"] | null;
  accessToken: string | null;
  csrfToken: string | null;
  initialized: boolean;
  bootstrapping: boolean;
  bootstrapLock: Promise<string | null> | null;
  login: (payload: LoginRequest) => Promise<AuthResponse>;
  register: (payload: RegisterRequest) => Promise<AuthResponse>;
  registerAnonymous: (payload: RegisterRequest) => Promise<AuthResponse>;
  refresh: () => Promise<string | null>;
  bootstrap: () => Promise<string | null>;
  logout: (payload?: Partial<LogoutRequest>) => Promise<void>;
  clearSession: () => void;
};

let refreshPromise: Promise<string | null> | null = null;

function applySession(set: (partial: Partial<AuthStore>) => void, response: AuthResponse) {
  set({
    user: response.user,
    session: response.session,
    accessToken: response.accessToken,
    csrfToken: response.csrfToken,
    initialized: true,
    bootstrapping: false,
  });
  setAuthHintCookie();
}

async function ensureCsrfToken() {
  const state = useAuthStore.getState();
  if (state.csrfToken) return;

  const cookieValue = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("gapak_csrf="))
    ?.split("=")[1];

  if (!cookieValue) {
    await authService.csrf();
  }
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  session: null,
  accessToken: null,
  csrfToken: null,
  initialized: false,
  bootstrapping: false,
  bootstrapLock: null,
  async login(payload) {
    await ensureCsrfToken();
    const response = await authService.login(payload);
    applySession(set, response);
    return response;
  },
  async register(payload) {
    await ensureCsrfToken();
    const response = await authService.register(payload);
    applySession(set, response);
    return response;
  },
  async registerAnonymous(payload) {
    await ensureCsrfToken();
    const response = await authService.registerAnonymous(payload);
    applySession(set, response);
    return response;
  },
  async refresh() {
    if (refreshPromise) {
      return refreshPromise;
    }

    refreshPromise = (async () => {
      try {
        const response = await authService.refresh();
        applySession(set, response);
        return response.accessToken;
      } catch {
        get().clearSession();
        return null;
      } finally {
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  },
  async bootstrap() {
    const { bootstrapLock } = get();
    if (bootstrapLock) {
      await bootstrapLock;
      return get().accessToken;
    }

    const lock = (async () => {
      const { accessToken, initialized } = get();
      if (accessToken) return accessToken;
      if (initialized) return accessToken;

      set({ bootstrapping: true });
      return get().refresh();
    })();

    set({ bootstrapLock: lock });

    try {
      const result = await lock;
      return result;
    } finally {
      set({ bootstrapLock: null });
    }
  },
  async logout(payload = {}) {
    try {
      await authService.logout({
        allDevices: false,
        ...payload,
      });
    } finally {
      get().clearSession();
    }
  },
  clearSession() {
    set({
      user: null,
      session: null,
      accessToken: null,
      csrfToken: null,
      initialized: true,
      bootstrapping: false,
    });
    clearAuthHintCookie();
  },
}));

configureApiClient({
  getAccessToken: () => useAuthStore.getState().accessToken,
  refreshAccessToken: () => useAuthStore.getState().refresh(),
  clearSession: () => useAuthStore.getState().clearSession(),
});
