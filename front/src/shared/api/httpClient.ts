/** GAPAK production HTTP transport.
 *
 * Responsibilities are deliberately limited to HTTP transport concerns:
 * URL resolution, credentials, request metadata, auth header injection,
 * refresh coordination, cancellation, response normalization and safe retry.
 * Domain semantics belong in domain API services.
 */
import { telemetry } from '../telemetry/telemetry';
import { ApiErrorResponse, HttpRequestConfig, HttpMethod } from '../types';
import { env, resolveApiUrl } from '../config/env';
import { tokenManager } from './tokenManager';
import { isRetryableMethod, retryDelayMs, shouldRetry } from './retryPolicy';

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly requestId?: string;
  public readonly details?: unknown;
  public readonly retryAfterMs?: number;

  constructor(message: string, status: number, code = 'API_ERROR', requestId?: string, details?: unknown, retryAfterMs?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.details = details;
    this.retryAfterMs = retryAfterMs;
  }
}

type TokenRefreshCallback = (token: string | null, error?: ApiError) => void;

class HttpClient {
  private csrfToken: string | null = null;
  private csrfBootstrapPromise: Promise<{ csrfToken: string; hasSession: boolean }> | null = null;
  private refreshPromise: Promise<string> | null = null;
  private refreshSubscribers: TokenRefreshCallback[] = [];
  private requestInterceptors: Array<(config: HttpRequestConfig) => HttpRequestConfig | Promise<HttpRequestConfig>> = [];
  private responseInterceptors: Array<(response: Response) => Response | Promise<Response>> = [];

  constructor() {
    // CSRF tokens are memory-only. The backend must issue a fresh token for each browser session.
  }

  /** Backwards-compatible signature: refresh tokens are intentionally ignored. */
  public setTokens(accessToken: string | null, _refreshToken?: string | null): void {
    tokenManager.setAccessToken(accessToken);
  }

  public setCsrfToken(token: string | null): void {
    this.csrfToken = token;
    // Never persist CSRF material in browser storage. Keep it only in memory.
  }

  /**
   * Issues a fresh memory-only CSRF token. All callers share one in-flight
   * request so concurrent mutation failures cannot race their recovery.
   */
  public async bootstrapCsrf(): Promise<{ csrfToken: string; hasSession: boolean }> {
    if (this.csrfBootstrapPromise) return this.csrfBootstrapPromise;

    this.csrfBootstrapPromise = (async () => {
      const requestId = this.generateRequestId();
      const headers: Record<string, string> = { Accept: 'application/json', 'X-Request-ID': requestId };
      const accessToken = tokenManager.getAccessToken();
      // The backend binds CSRF tokens to the first valid credential it sees.
      // Supplying the current bearer token prevents a stale/rotated refresh
      // cookie from binding recovery to a different session.
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
      const { responseStatus, responseData } = await this.fetchOnce(
        resolveApiUrl('/auth/csrf'),
        'GET',
        headers,
        undefined,
        undefined,
        15_000,
      );
      if (responseStatus < 200 || responseStatus >= 300) {
        throw this.toApiError(responseData, responseStatus, requestId, 'CSRF_BOOTSTRAP_FAILED');
      }

      const payload = this.unwrapSuccess<{ csrfToken?: unknown; hasSession?: unknown }>(responseData, responseStatus, requestId);
      if (typeof payload.csrfToken !== 'string' || payload.csrfToken.length < 16) {
        throw new ApiError('CSRF bootstrap failed', 502, 'CSRF_BOOTSTRAP_FAILED', requestId);
      }
      this.setCsrfToken(payload.csrfToken);
      return { csrfToken: payload.csrfToken, hasSession: payload.hasSession === true };
    })().finally(() => {
      this.csrfBootstrapPromise = null;
    });

    return this.csrfBootstrapPromise;
  }

  public getAccessToken(): string | null { return tokenManager.getAccessToken(); }

  public addRequestInterceptor(interceptor: (config: HttpRequestConfig) => HttpRequestConfig | Promise<HttpRequestConfig>): void {
    this.requestInterceptors.push(interceptor);
  }

  public addResponseInterceptor(interceptor: (response: Response) => Response | Promise<Response>): void {
    this.responseInterceptors.push(interceptor);
  }

  public clearSession(): void {
    tokenManager.clear();
    this.setCsrfToken(null);
  }

  private generateRequestId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  private subscribeTokenRefresh(callback: TokenRefreshCallback): void {
    this.refreshSubscribers.push(callback);
  }

  private notifyTokenRefresh(newToken: string | null, error?: ApiError): void {
    const subscribers = [...this.refreshSubscribers];
    this.refreshSubscribers = [];
    subscribers.forEach((cb) => cb(newToken, error));
  }

  /** Single-flight refresh. The refresh credential is an HttpOnly cookie, never JS-readable. */
  public async refreshSession(): Promise<string> {
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = this.executeCoordinatedRefreshRequest().finally(() => {
      this.refreshPromise = null;
    });

    return this.refreshPromise;
  }

  /** Kept as a compatibility alias for existing development tooling. */
  public async performTokenRefresh(): Promise<string> {
    return this.refreshSession();
  }

  private async executeCoordinatedRefreshRequest(): Promise<string> {
    // Refresh tokens rotate on every use. A per-tab Promise is insufficient:
    // two tabs reloading together could submit the same cookie concurrently
    // and trigger replay protection. Web Locks serialize the rotation across
    // tabs while the HttpOnly cookie remains the only refresh credential.
    if (typeof navigator !== 'undefined' && navigator.locks) {
      return navigator.locks.request('gapak-session-refresh', { mode: 'exclusive' }, () => this.executeRefreshRequest());
    }
    return this.executeRefreshRequest();
  }

  private async executeRefreshRequest(): Promise<string> {
    telemetry.record('auth', 'session_refresh_started', 'info');
    const requestId = this.generateRequestId();
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'X-Request-ID': requestId,
    };
    if (this.csrfToken) headers['X-CSRF-Token'] = this.csrfToken;

    try {
      const { responseStatus, responseData } = await this.fetchOnce(
        resolveApiUrl('/auth/refresh'),
        'POST',
        headers,
        undefined,
        undefined,
        15_000,
      );

      if (responseStatus < 200 || responseStatus >= 300) {
        throw this.toApiError(responseData, responseStatus, requestId, 'REFRESH_FAILED');
      }

      const payload = this.unwrapSuccess<Record<string, unknown>>(responseData, responseStatus, requestId);
      if (!payload || typeof payload.accessToken !== 'string') {
        throw new ApiError('Refresh response did not contain an access token', 401, 'INVALID_REFRESH_RESPONSE', requestId);
      }

      tokenManager.setAccessToken(payload.accessToken);
      // /auth/refresh rotates the session and issues a CSRF token bound to the
      // new session ID. The old in-memory token is bound to the previous
      // session and will be rejected by the backend, so it must be replaced
      // here rather than left stale.
      if (typeof payload.csrfToken === 'string' && payload.csrfToken.length >= 16) {
        this.setCsrfToken(payload.csrfToken);
      }
      this.notifyTokenRefresh(payload.accessToken);
      window.dispatchEvent(new CustomEvent('gapak:session-refreshed'));
      telemetry.record('auth', 'session_refresh_succeeded', 'info');
      return payload.accessToken;
    } catch (error) {
      const apiError = error instanceof ApiError
        ? error
        : new ApiError('Session refresh failed', 401, 'REFRESH_FAILED', requestId);
      this.clearSession();
      this.notifyTokenRefresh(null, apiError);
      telemetry.trackError('Session refresh failed', apiError);
      throw apiError;
    }
  }

  public async request<T = unknown>(config: HttpRequestConfig): Promise<T> {
    let reqConfig: HttpRequestConfig = { ...config };
    for (const interceptor of this.requestInterceptors) reqConfig = await interceptor(reqConfig);

    const {
      url,
      method = 'GET',
      params,
      data,
      headers: customHeaders = {},
      skipAuth = false,
      retryCount = 2,
      idempotencyKey,
      signal,
      timeoutMs = 15_000,
      authRetry = false,
      csrfRetry = false,
      includeResponseMeta = false,
    } = reqConfig;

    const requestId = this.generateRequestId();
    let fullUrl = resolveApiUrl(url);
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => value !== undefined && searchParams.append(key, String(value)));
      const query = searchParams.toString();
      if (query) fullUrl += `${fullUrl.includes('?') ? '&' : '?'}${query}`;
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'X-Request-ID': requestId,
      ...customHeaders,
    };
    if (data !== undefined && !(data instanceof FormData) && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    if (this.csrfToken && !skipAuth) headers['X-CSRF-Token'] = this.csrfToken;
    if (!skipAuth) {
      const token = tokenManager.getAccessToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    if (idempotencyKey) headers['X-Idempotency-Key'] = idempotencyKey;

    const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const { responseStatus, responseData, ok, retryAfterMs, responseHeaders } = await this.executeTransport(
      fullUrl, method, headers, data, signal, timeoutMs, retryCount, idempotencyKey, requestId,
    );
    const latencyMs = Math.max(0, (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt);

    // A rejected CSRF check happens before the domain handler, so repeating the
    // mutation after a fresh token is safe. Retry only this explicit backend
    // error, and only once; an arbitrary 403 must never be replayed.
    if (responseStatus === 403 && !skipAuth && !csrfRetry && method !== 'GET') {
      const csrfError = this.toApiError(responseData, responseStatus, requestId);
      if (/csrf/i.test(csrfError.code)) {
        await this.bootstrapCsrf();
        return this.request<T>({ ...config, csrfRetry: true });
      }
    }

    if (responseStatus === 401 && !skipAuth && !authRetry && !url.endsWith('/auth/refresh') && !url.includes('/auth/login') && !url.includes('/auth/register')) {
      try {
        const newAccessToken = await this.refreshSession();
        return this.request<T>({
          ...config,
          headers: { ...customHeaders, Authorization: `Bearer ${newAccessToken}` },
          authRetry: true,
        });
      } catch (error) {
        throw error;
      }
    }

    if (!ok) {
      const apiError = this.toApiError(responseData, responseStatus, requestId, undefined, retryAfterMs ?? this.parseRetryAfterFromPayload(responseData));
      telemetry.trackApiFailure(fullUrl, responseStatus, apiError.message, requestId);
      telemetry.trackPerfMark('api_request', latencyMs, { requestId, method, status: responseStatus });
      throw apiError;
    }

    telemetry.record('api', 'request_succeeded', 'debug', { requestId, status: responseStatus, method });
    const unwrappedData = this.unwrapSuccess<T>(responseData, responseStatus, requestId);
    if (includeResponseMeta) {
      const meta = responseData && typeof responseData === 'object' && 'meta' in responseData
        ? (responseData as { meta?: unknown }).meta
        : undefined;
      return { data: unwrappedData, headers: responseHeaders, status: responseStatus, requestId, ...(meta && typeof meta === 'object' ? { meta } : {}) } as T;
    }
    return unwrappedData;
  }

  private async executeTransport(
    fullUrl: string,
    method: HttpMethod,
    headers: Record<string, string>,
    data: unknown,
    signal: AbortSignal | undefined,
    timeoutMs: number,
    retryCount: number,
    idempotencyKey: string | undefined,
    requestId: string,
  ): Promise<{ responseStatus: number; responseData: unknown; ok: boolean; retryAfterMs?: number; responseHeaders?: Headers }> {
    let attempt = 0;
    const maxAttempts = Math.min(5, Math.max(0, retryCount));
    while (true) {
      try {
        const result = await this.fetchOnce(fullUrl, method, headers, data, signal, timeoutMs);
        const retryAfter = this.parseRetryAfter(result.responseHeaders);
        if (result.responseStatus < 400 || !shouldRetry({ method, idempotencyKey, attempt, maxAttempts, errorStatus: result.responseStatus })) return { ...result, retryAfterMs: retryAfter };
        await this.delay(retryDelayMs(attempt, retryAfter), signal);
        attempt += 1;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') throw error;
        if (error instanceof ApiError && error.status > 0 && !shouldRetry({ method, idempotencyKey, attempt, maxAttempts, errorStatus: error.status })) throw error;
        if (attempt >= maxAttempts || !isRetryableMethod(method, idempotencyKey)) throw error;
        await this.delay(retryDelayMs(attempt), signal);
        attempt += 1;
      }
    }
  }

  private async fetchOnce(
    fullUrl: string,
    method: HttpMethod,
    headers: Record<string, string>,
    data: unknown,
    signal: AbortSignal | undefined,
    timeoutMs: number,
  ): Promise<{ responseStatus: number; responseData: unknown; ok: boolean; responseHeaders: Headers }> {
    let response: Response;
    const controller = new AbortController();
    let timedOut = false;
    const onAbort = () => controller.abort();
    const timeout = timeoutMs > 0 ? window.setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs) : undefined;
    signal?.addEventListener('abort', onAbort, { once: true });
    try {
      response = await fetch(fullUrl, {
        method,
        headers,
        credentials: 'include',
        body: data instanceof FormData ? data : data !== undefined ? JSON.stringify(data) : undefined,
        signal: controller.signal,
      });
      for (const interceptor of this.responseInterceptors) response = await interceptor(response);
    } catch (error) {
      if (timeout !== undefined) window.clearTimeout(timeout);
      signal?.removeEventListener('abort', onAbort);
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      if (timedOut) throw new ApiError('Request timed out', 0, 'TIMEOUT');
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      throw new ApiError(error instanceof Error ? error.message : 'Network request failed', 0, 'NETWORK_ERROR');
    }
    if (timeout !== undefined) window.clearTimeout(timeout);
    signal?.removeEventListener('abort', onAbort);

    let responseData: unknown = null;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try { responseData = await response.json(); } catch { responseData = null; }
    } else {
      try { responseData = await response.text(); } catch { responseData = null; }
    }
    return { responseStatus: response.status, responseData, ok: response.ok, responseHeaders: response.headers };
  }

  private parseRetryAfter(headers: Headers): number | undefined {
    const value = headers.get('Retry-After');
    if (!value) return undefined;
    const seconds = Number(value);
    if (Number.isFinite(seconds)) return seconds * 1000;
    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp) ? undefined : Math.max(0, timestamp - Date.now());
  }

  private delay(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
      let settled = false;
      const cleanup = () => signal?.removeEventListener('abort', onAbort);
      const timer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      }, ms);
      const onAbort = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        cleanup();
        reject(new DOMException('Aborted', 'AbortError'));
      };
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }

  private unwrapSuccess<T>(payload: unknown, status: number, requestId: string): T {
    if (status === 204) return undefined as T;
    if (!payload || typeof payload !== 'object') {
      throw new ApiError('Backend returned an invalid response envelope', status, 'INVALID_RESPONSE_ENVELOPE', requestId);
    }
    const envelope = payload as { success?: unknown; data?: unknown; meta?: { requestId?: unknown } };
    if (envelope.success !== true || !('data' in envelope)) {
      throw new ApiError('Backend returned an invalid success envelope', status, 'INVALID_RESPONSE_ENVELOPE',
        typeof envelope.meta?.requestId === 'string' ? envelope.meta.requestId : requestId);
    }
    return envelope.data as T;
  }

  private parseRetryAfterFromPayload(payload: unknown): number | undefined {
    if (!payload || typeof payload !== 'object') return undefined;
    const value = (payload as Record<string, unknown>).retryAfterMs;
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : undefined;
  }

  private toApiError(payload: unknown, status: number, requestId: string, fallbackCode = `HTTP_${status}`, retryAfterMs?: number): ApiError {
    const errorPayload = payload as ApiErrorResponse | { message?: string; code?: string } | null;
    const nested = errorPayload && typeof errorPayload === 'object' && 'error' in errorPayload ? errorPayload.error : undefined;
    const nestedRecord = nested && typeof nested === 'object' ? nested as Record<string, unknown> : undefined;
    const message = typeof nestedRecord?.message === 'string'
      ? nestedRecord.message
      : typeof (errorPayload as { message?: unknown })?.message === 'string'
        ? String((errorPayload as { message?: unknown }).message)
        : `HTTP ${status} Error`;
    const code = typeof nestedRecord?.code === 'string'
      ? nestedRecord.code
      : typeof (errorPayload as { code?: unknown })?.code === 'string'
        ? String((errorPayload as { code?: unknown }).code)
        : fallbackCode;
    const details = nestedRecord?.details;
    const meta = errorPayload && typeof errorPayload === 'object' && 'meta' in errorPayload
      ? (errorPayload as { meta?: { requestId?: unknown } }).meta
      : undefined;
    const serverRequestId = typeof meta?.requestId === 'string' ? meta.requestId : requestId;
    return new ApiError(message, status, code, serverRequestId, details, retryAfterMs);
  }

  public get<T>(url: string, config?: Omit<HttpRequestConfig, 'url' | 'method'>): Promise<T> { return this.request<T>({ ...config, url, method: 'GET' }); }
  public post<T>(url: string, data?: unknown, config?: Omit<HttpRequestConfig, 'url' | 'method' | 'data'>): Promise<T> { return this.request<T>({ ...config, url, method: 'POST', data }); }
  public put<T>(url: string, data?: unknown, config?: Omit<HttpRequestConfig, 'url' | 'method' | 'data'>): Promise<T> { return this.request<T>({ ...config, url, method: 'PUT', data }); }
  public patch<T>(url: string, data?: unknown, config?: Omit<HttpRequestConfig, 'url' | 'method' | 'data'>): Promise<T> { return this.request<T>({ ...config, url, method: 'PATCH', data }); }
  public delete<T>(url: string, config?: Omit<HttpRequestConfig, 'url' | 'method'>): Promise<T> { return this.request<T>({ ...config, url, method: 'DELETE' }); }
}

export const httpClient = new HttpClient();
