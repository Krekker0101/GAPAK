export const publicEnv = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "Gapak",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1",
  authHintCookie: process.env.NEXT_PUBLIC_AUTH_HINT_COOKIE ?? "gapak_auth_hint",
  csrfCookieName: process.env.NEXT_PUBLIC_CSRF_COOKIE_NAME ?? "gapak_csrf",
} as const;

export const serverEnv = {
  backendUrl: process.env.GAPAK_BACKEND_URL ?? "http://localhost:8080",
  backendApiPrefix: process.env.GAPAK_BACKEND_API_PREFIX ?? "/api/v1",
  csrfCookieName: process.env.GAPAK_CSRF_COOKIE_NAME ?? "gapak_csrf",
} as const;
