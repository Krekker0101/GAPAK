/**
 * GAPAK runtime configuration.
 * Production must never silently fall back to development mocks.
 */

const readBoolean = (value: unknown, fallback = false): boolean => {
  if (typeof value !== 'string') return fallback;
  return value.toLowerCase() === 'true';
};

export const env = Object.freeze({
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, ''),
  wsBaseUrl: (import.meta.env.VITE_WS_BASE_URL ?? '').replace(/\/$/, ''),
  mediaBaseUrl: (import.meta.env.VITE_MEDIA_BASE_URL ?? '').replace(/\/$/, ''),
  environment: import.meta.env.VITE_ENVIRONMENT ?? (import.meta.env.DEV ? 'development' : 'production'),
  // Mocks are intentionally limited to development builds.
  enableMockApi: import.meta.env.DEV && readBoolean(import.meta.env.VITE_ENABLE_MOCK_API, false),
  enablePlatformSandbox: import.meta.env.DEV && readBoolean(import.meta.env.VITE_ENABLE_PLATFORM_SANDBOX, true),
});

export const resolveApiUrl = (url: string): string => {
  if (/^https?:\/\//i.test(url)) return url;
  const path = url.startsWith('/') ? url : `/${url}`;
  // Domain clients use `/api/...`, while the backend exposes its public API
  // under `/api/v1`. Normalize at one boundary so no client calls the backend
  // root and renders its raw NOT_FOUND JSON response in the browser.
  const versionedPath = path === '/api' || path.startsWith('/api/')
    ? `/api/v1${path.slice('/api'.length)}`
    : path;
  return `${env.apiBaseUrl}${versionedPath}`;
};
