/**
 * GAPAK runtime configuration.
 * Production must never silently fall back to development mocks.
 */

const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/$/, '');
// Production HTTP is same-origin by default so HttpOnly refresh cookies remain
// first-party behind the Vercel external rewrite. Direct cross-site API access
// is an explicit escape hatch for non-Vercel deployments, never the default.
const useDirectProductionApi = import.meta.env.PROD && import.meta.env.VITE_USE_DIRECT_API === 'true';

export const env = Object.freeze({
  apiBaseUrl: import.meta.env.PROD && !useDirectProductionApi ? '' : configuredApiBaseUrl,
  wsBaseUrl: (import.meta.env.VITE_WS_BASE_URL ?? '').replace(/\/$/, ''),
  mediaBaseUrl: (import.meta.env.VITE_MEDIA_BASE_URL ?? '').replace(/\/$/, ''),
  webPushPublicKey: (import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY ?? '').trim(),
  environment: import.meta.env.VITE_ENVIRONMENT ?? (import.meta.env.DEV ? 'development' : 'production'),
});

/** Canonicalize all relative API paths to exactly one /api/v1 prefix. */
export const resolveApiUrl = (url: string): string => {
  if (/^https?:\/\//i.test(url)) return url;
  const rawPath = url.startsWith('/') ? url : `/${url}`;
  const base = env.apiBaseUrl.replace(/\/api\/v1\/?$/i, '').replace(/\/$/, '');
  const path = rawPath.replace(/^\/api\/v1(?=\/|$)/i, '').replace(/^\/api(?=\/|$)/i, '');
  return `${base}/api/v1${path === '/' ? '' : path}`;
};
