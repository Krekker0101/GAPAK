import type { HttpMethod } from '../types';

export interface RetryDecisionContext {
  method: HttpMethod;
  idempotencyKey?: string;
  attempt: number;
  maxAttempts: number;
  errorStatus?: number;
}

export const isRetryableMethod = (method: HttpMethod, idempotencyKey?: string): boolean =>
  ['GET', 'HEAD', 'OPTIONS'].includes(method) || Boolean(idempotencyKey);

export const shouldRetry = ({ method, idempotencyKey, attempt, maxAttempts, errorStatus }: RetryDecisionContext): boolean => {
  if (attempt >= maxAttempts || !isRetryableMethod(method, idempotencyKey)) return false;
  if (errorStatus !== undefined && errorStatus >= 400 && errorStatus < 500 && errorStatus !== 408 && errorStatus !== 429) return false;
  return true;
};

export const retryDelayMs = (attempt: number, retryAfterMs?: number, random: () => number = Math.random): number => {
  if (retryAfterMs !== undefined) return Math.min(30_000, Math.max(0, retryAfterMs));
  const exponential = Math.min(8_000, 250 * 2 ** attempt);
  return exponential + Math.floor(Math.max(0, Math.min(0.999999, random())) * 150);
};
