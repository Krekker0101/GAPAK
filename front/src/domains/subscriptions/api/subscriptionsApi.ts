import { httpClient } from '../../../shared/api/httpClient';

export interface SubscriptionItem {
  id: string;
  creatorId?: string;
  subscriberId?: string;
  status?: string;
  type?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

/** Mirrors the current /subscriptions controller; no cursor contract is assumed. */
export const subscriptionsApi = {
  listFollowing: (signal?: AbortSignal) =>
    httpClient.get<SubscriptionItem[]>('/subscriptions/following', { signal }),
  subscribe: (creatorId: string, idempotencyKey: string) =>
    httpClient.post<SubscriptionItem>(`/subscriptions/${encodeURIComponent(creatorId)}`, undefined, { idempotencyKey }),
  unsubscribe: (creatorId: string, idempotencyKey?: string) =>
    httpClient.delete<void>(`/subscriptions/${encodeURIComponent(creatorId)}`, { idempotencyKey }),
  status: (creatorId: string, signal?: AbortSignal) =>
    httpClient.get<unknown>(`/subscriptions/${encodeURIComponent(creatorId)}/status`, { signal }),
};
