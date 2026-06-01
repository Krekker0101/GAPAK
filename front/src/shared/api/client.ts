import { publicEnv } from "@/shared/config/env";
import { buildQueryString } from "@/shared/lib/utils";
import { ApiError, type ApiEnvelope } from "@/shared/types/api";

type ApiClientOptions = {
  path: string;
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  headers?: HeadersInit;
  auth?: boolean;
  retryOnAuth?: boolean;
  signal?: AbortSignal;
};

type AuthBridge = {
  getAccessToken: () => string | null;
  refreshAccessToken: () => Promise<string | null>;
  clearSession: () => void;
};

const authBridge: AuthBridge = {
  getAccessToken: () => null,
  refreshAccessToken: async () => null,
  clearSession: () => undefined,
};

export function configureApiClient(partial: Partial<AuthBridge>) {
  Object.assign(authBridge, partial);
}

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  const requestId = response.headers.get("x-request-id") ?? undefined;
  const text = await response.text();

  if (!text) {
    return undefined as T;
  }

  if (!contentType.includes("application/json")) {
    if (!response.ok) {
      throw new ApiError({
        code: "http.unexpected_content_type",
        message: text,
        status: response.status,
        requestId,
      });
    }

    return text as T;
  }

  const parsed = JSON.parse(text) as ApiEnvelope<T>;

  if (!response.ok) {
    if ("error" in parsed) {
      throw new ApiError({
        code: parsed.error.code,
        message: parsed.error.message,
        status: response.status,
        details: parsed.error.details,
        requestId: parsed.meta?.requestId ?? requestId,
      });
    }

    throw new ApiError({
      code: "http.request_failed",
      message: "Request failed",
      status: response.status,
      requestId,
    });
  }

  if ("success" in parsed && parsed.success && "data" in parsed) {
    return parsed.data;
  }

  return parsed as T;
}

function readCookie(name: string) {
  if (typeof document === "undefined") {
    return null;
  }

  const rawValue =
    document.cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`))
      ?.slice(name.length + 1) ?? null;

  if (!rawValue) {
    return null;
  }

  try {
    return decodeURIComponent(rawValue);
  } catch {
    return rawValue;
  }
}

function isMutatingMethod(method: ApiClientOptions["method"]) {
  return method !== "GET";
}

export async function apiClient<T>({
  path,
  method = "GET",
  body,
  query,
  headers,
  auth = true,
  retryOnAuth = true,
  signal,
}: ApiClientOptions): Promise<T> {
  const requestHeaders = new Headers(headers);
  const accessToken = auth ? authBridge.getAccessToken() : null;

  requestHeaders.set("Accept", "application/json");
  if (body && !(body instanceof FormData)) {
    requestHeaders.set("Content-Type", "application/json");
  }
  if (auth && accessToken) {
    requestHeaders.set("Authorization", `Bearer ${accessToken}`);
  }
  if (isMutatingMethod(method) && !requestHeaders.has("X-CSRF-Token")) {
    const csrfToken = readCookie(publicEnv.csrfCookieName);
    if (csrfToken) {
      requestHeaders.set("X-CSRF-Token", csrfToken);
    }
  }

  const response = await fetch(`${publicEnv.apiBaseUrl}${path}${buildQueryString(query)}`, {
    method,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    headers: requestHeaders,
    credentials: "include",
    cache: "no-store",
    signal,
  });

  if (response.status === 401 && auth && retryOnAuth && path !== "/auth/refresh") {
    const refreshedToken = await authBridge.refreshAccessToken();
    if (!refreshedToken) {
      authBridge.clearSession();
      throw await parseResponse<T>(response);
    }

    return apiClient<T>({
      path,
      method,
      body,
      query,
      headers,
      auth,
      retryOnAuth: false,
      signal,
    });
  }

  return parseResponse<T>(response);
}
