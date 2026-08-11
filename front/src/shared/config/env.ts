/**
 * GAPAK runtime configuration.
 * Production must never silently fall back to development mocks.
 */

const readBoolean = (value: unknown, fallback = false): boolean => {
  if (typeof value !== 'string') return fallback;
  return value.toLowerCase() === 'true';
};

export const env = Object.freeze({
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/$/, ''),
  wsBaseUrl: (import.meta.env.VITE_WS_BASE_URL ?? '').replace(/\/$/, ''),
  mediaBaseUrl: (import.meta.env.VITE_MEDIA_BASE_URL ?? '').replace(/\/$/, ''),
  environment: import.meta.env.VITE_ENVIRONMENT ?? (import.meta.env.DEV ? 'development' : 'production'),
  enableMockApi: import.meta.env.DEV && readBoolean(import.meta.env.VITE_ENABLE_MOCK_API, false),
  enablePlatformSandbox: import.meta.env.DEV && readBoolean(import.meta.env.VITE_ENABLE_PLATFORM_SANDBOX, true),
});

/** Canonicalize all relative API paths to exactly one /api/v1 prefix. */
export const resolveApiUrl = (url: string): string => {
  if (/^https?:\/\//i.test(url)) return url;
  const rawPath = url.startsWith('/') ? url : `/${url}`;
  const base = env.apiBaseUrl.replace(/\/api\/v1\/?$/i, '').replace(/\/$/, '');
  const path = rawPath.replace(/^\/api\/v1(?=\/|$)/i, '').replace(/^\/api(?=\/|$)/i, '');
  return `${base}/api/v1${path === '/' ? '' : path}`;
};
