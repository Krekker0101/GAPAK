import { httpClient } from '../../../shared/api/httpClient';
import type { NotificationsList, NotificationItem } from '../../../shared/api/backendContracts';

export const notificationsApi = {
  list: (params: { limit?: number } = {}, signal?: AbortSignal) => httpClient.get<NotificationsList>('/notifications', { params, signal }),
  unreadCount: (signal?: AbortSignal) => httpClient.get<{ count: number }>('/notifications/unread-count', { signal }),
  markRead: (id: string, signal?: AbortSignal) => httpClient.post<void>(`/notifications/${encodeURIComponent(id)}/read`, undefined, { signal }),
  markAllRead: (signal?: AbortSignal) => httpClient.post<void>('/notifications/read-all', undefined, { signal }),
};

export type { NotificationItem };
