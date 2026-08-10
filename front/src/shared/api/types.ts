import { HttpRequestConfig, HttpMethod, ApiErrorResponse } from '../types';

export interface RequestMetadata {
  requestId: string;
  method: HttpMethod;
  url: string;
  attempt: number;
  startedAt: number;
}

export type ApiTransport = <T>(config: HttpRequestConfig) => Promise<T>;

export type ApiEnvelope<T> = T | { data: T; meta?: Record<string, unknown> };

export type ApiFailurePayload = ApiErrorResponse | { message?: string; code?: string; error?: unknown } | null;
