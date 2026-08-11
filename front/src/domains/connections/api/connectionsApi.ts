import { httpClient } from '../../../shared/api/httpClient';
import { ConnectionRequest, SubscriptionItem } from '../../../shared/types/social';
export const connectionsApi = {
  list: async (_params?: { cursor?: string; limit?: number }, signal?: AbortSignal) => {
    const rows = await httpClient.get<any[]>('/api/connections', { signal });
    const items = rows.map((row) => { const person = (id: string) => ({ id, username: id.slice(0, 8), displayName: id.slice(0, 8), email: '', role: 'user', status: 'ACTIVE', presence: 'offline', trustScore: 0, permissions: [] } as any); return { id: row.id, sender: person(row.requesterId), receiver: person(row.addresseeId), status: String(row.status).toLowerCase() === 'pending' ? 'pending' : 'accepted', createdAt: row.createdAt } as ConnectionRequest; });
    return { items, nextCursor: null };
  },
  request: (userId: string, idempotencyKey: string) => httpClient.post<ConnectionRequest>('/api/connections/requests', { userId }, { idempotencyKey }),
  accept: (requestId: string, idempotencyKey: string) => httpClient.post<void>(`/api/connections/requests/${encodeURIComponent(requestId)}/accept`, undefined, { idempotencyKey }),
  reject: (requestId: string, idempotencyKey: string) => httpClient.post<void>(`/api/connections/${encodeURIComponent(requestId)}`, undefined, { idempotencyKey }),
  remove: (connectionId: string, idempotencyKey: string) => httpClient.delete<void>(`/api/connections/${encodeURIComponent(connectionId)}`, { idempotencyKey }),
  subscriptions: (params?: { cursor?: string; limit?: number }, signal?: AbortSignal) => httpClient.get<{ items: SubscriptionItem[]; nextCursor?: string | null }>('/api/subscriptions/following', { params, signal }),
};
