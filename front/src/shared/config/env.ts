let envAny: any;
try {
  envAny = (import.meta as any).env;
} catch (e) {
  envAny = typeof process !== 'undefined' ? process.env : {};
}

export const publicEnv = {
  appName: envAny.VITE_PUBLIC_APP_NAME ?? envAny.NEXT_PUBLIC_APP_NAME ?? "Gapak",
  appUrl: envAny.VITE_PUBLIC_APP_URL ?? envAny.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  apiBaseUrl: envAny.VITE_PUBLIC_API_BASE_URL ?? envAny.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1",
  authHintCookie: envAny.VITE_PUBLIC_AUTH_HINT_COOKIE ?? envAny.NEXT_PUBLIC_AUTH_HINT_COOKIE ?? "gapak_auth_hint",
  csrfCookieName: envAny.VITE_PUBLIC_CSRF_COOKIE_NAME ?? envAny.NEXT_PUBLIC_CSRF_COOKIE_NAME ?? "gapak_csrf",
} as const;

export const serverEnv = {
  backendUrl: envAny.GAPAK_BACKEND_URL ?? "http://localhost:8080",
  backendApiPrefix: envAny.GAPAK_BACKEND_API_PREFIX ?? "/api/v1",
  csrfCookieName: envAny.GAPAK_CSRF_COOKIE_NAME ?? "gapak_csrf",
} as const;
