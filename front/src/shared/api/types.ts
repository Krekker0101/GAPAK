import type { HttpRequestConfig, HttpMethod } from '../types';
import type { ApiErrorEnvelope } from './backendContracts';

export interface RequestMetadata {
  requestId: string;
  method: HttpMethod;
  url: string;
  attempt: number;
  startedAt: number;
}

export type ApiTransport = <T>(config: HttpRequestConfig) => Promise<T>;
export type ApiEnvelope<T> = {
  success: true;
  data: T;
  meta?: { requestId?: string; pagination?: Record<string, unknown> };
};
export type ApiFailurePayload = ApiErrorEnvelope | null;
