import { httpClient } from '../../../shared/api/httpClient';
import { ConnectionRequest, SubscriptionItem } from '../../../shared/types/social';
export const connectionsApi = {
  list: (params?: { cursor?: string; limit?: number }, signal?: AbortSignal) => httpClient.get<{ items: ConnectionRequest[]; nextCursor?: string | null }>('/api/connections', { params, signal }),
  request: (userId: string, idempotencyKey: string) => httpClient.post<ConnectionRequest>('/api/connections/requests', { userId }, { idempotencyKey }),
  accept: (requestId: string, idempotencyKey: string) => httpClient.post<void>(`/api/connections/requests/${encodeURIComponent(requestId)}/accept`, undefined, { idempotencyKey }),
  reject: (requestId: string, idempotencyKey: string) => httpClient.post<void>(`/api/connections/requests/${encodeURIComponent(requestId)}/reject`, undefined, { idempotencyKey }),
  remove: (userId: string, idempotencyKey: string) => httpClient.delete<void>(`/api/connections/${encodeURIComponent(userId)}`, { idempotencyKey }),
  subscriptions: (params?: { cursor?: string; limit?: number }, signal?: AbortSignal) => httpClient.get<{ items: SubscriptionItem[]; nextCursor?: string | null }>('/api/subscriptions', { params, signal }),
};
