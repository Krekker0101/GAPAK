"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { useAuthStore } from "@/features/auth/store/auth-store";
import { publicEnv } from "@/shared/config/env";
import { presenceService } from "@/shared/api/services/presence.service";
import type { PresenceSignalState } from "@/shared/types/presence";

const CONNECTION_STORAGE_KEY = "gapak_presence_connection_id";
const HEARTBEAT_INTERVAL_MS = 15_000;
const IDLE_TIMEOUT_MS = 60_000;

function getOrCreateConnectionId() {
  const existing = window.sessionStorage.getItem(CONNECTION_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const generated =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `00000000-0000-4000-8000-${Date.now().toString().padStart(12, "0").slice(-12)}`;
  window.sessionStorage.setItem(CONNECTION_STORAGE_KEY, generated);
  return generated;
}

export function PresenceSync() {
  const pathname = usePathname();
  const accessToken = useAuthStore((state) => state.accessToken);

  const accessTokenRef = useRef<string | null>(accessToken);
  const connectionIdRef = useRef<string | null>(null);
  const currentPathRef = useRef(pathname);
  const lastActivityRef = useRef(Date.now());
  const stateRef = useRef<PresenceSignalState>("ACTIVE");

  accessTokenRef.current = accessToken;
  currentPathRef.current = pathname;

  const sendHeartbeat = useCallback(async (requestedState?: PresenceSignalState) => {
    if (!accessTokenRef.current || !connectionIdRef.current) {
      return;
    }

    const derivedState =
      requestedState ?? (Date.now() - lastActivityRef.current >= IDLE_TIMEOUT_MS ? "IDLE" : "ACTIVE");
    stateRef.current = derivedState;

    await presenceService.heartbeat({
      connectionId: connectionIdRef.current,
      state: derivedState,
      pagePath: currentPathRef.current,
    });
  }, []);

  const sendDisconnect = useCallback(async (reason: string) => {
    if (!connectionIdRef.current) {
      return;
    }

    const { refresh, clearSession } = useAuthStore.getState();
    let token = accessTokenRef.current;

    if (!token) {
      return;
    }

    const requestDisconnect = async (currentToken: string, shouldRetry = true) => {
      const response = await fetch(`${publicEnv.apiBaseUrl}/presence/disconnect`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentToken}`,
        },
        body: JSON.stringify({
          connectionId: connectionIdRef.current,
          reason,
        }),
        credentials: "include",
        keepalive: true,
        cache: "no-store",
      });

      if (response.status === 401 && shouldRetry) {
        const refreshedToken = await refresh();
        if (!refreshedToken) {
          clearSession();
          return;
        }

        accessTokenRef.current = refreshedToken;
        await requestDisconnect(refreshedToken, false);
      }
    };

    try {
      await requestDisconnect(token);
    } catch {
      // Best-effort disconnect; failures are ignored to avoid disrupting the app.
    }
  }, []);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    connectionIdRef.current = getOrCreateConnectionId();
    lastActivityRef.current = Date.now();
    stateRef.current = "ACTIVE";
    void sendHeartbeat("ACTIVE");

    const onActivity = () => {
      lastActivityRef.current = Date.now();
      if (stateRef.current !== "ACTIVE") {
        void sendHeartbeat("ACTIVE");
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        void sendHeartbeat("IDLE");
        return;
      }

      lastActivityRef.current = Date.now();
      void sendHeartbeat("ACTIVE");
    };

    const onPageHide = () => {
      sendDisconnect("pagehide");
    };

    const intervalId = window.setInterval(() => {
      void sendHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);

    window.addEventListener("focus", onActivity);
    window.addEventListener("mousemove", onActivity);
    window.addEventListener("keydown", onActivity);
    window.addEventListener("pointerdown", onActivity);
    window.addEventListener("touchstart", onActivity, { passive: true });
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onPageHide);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onActivity);
      window.removeEventListener("mousemove", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("touchstart", onActivity);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onPageHide);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      sendDisconnect("cleanup");
    };
  }, [accessToken, sendDisconnect, sendHeartbeat]);

  useEffect(() => {
    if (!accessToken || !connectionIdRef.current) {
      return;
    }

    void sendHeartbeat(stateRef.current);
  }, [accessToken, pathname, sendHeartbeat]);

  return null;
}
