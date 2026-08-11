import { httpClient } from '../../../shared/api/httpClient';
import { SubscriptionItem } from '../../../shared/types/social';

export interface SubscriptionPage { items: SubscriptionItem[]; nextCursor?: string | null; hasMore?: boolean; }

/** Backend contract: GET /api/subscriptions and DELETE/POST /api/subscriptions/:userId. */
export const subscriptionsApi = {
  list: (params?: { cursor?: string; limit?: number }, signal?: AbortSignal) =>
    httpClient.get<SubscriptionPage>('/api/subscriptions/following', { params, signal }),
  subscribe: (userId: string, idempotencyKey: string) =>
    httpClient.post<SubscriptionItem>(`/api/subscriptions/${encodeURIComponent(userId)}`, undefined, { idempotencyKey }),
  unsubscribe: (userId: string) =>
    httpClient.delete<void>(`/api/subscriptions/${encodeURIComponent(userId)}`),
};
