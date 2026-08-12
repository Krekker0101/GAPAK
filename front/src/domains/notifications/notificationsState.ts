import type { NotificationItem, NotificationsList } from '../../shared/api/backendContracts';

export interface NotificationsState {
  items: NotificationItem[];
  hasMore: boolean;
  optimisticReadIds: Set<string>;
}

export const mergeNotifications = (...pages: NotificationsList[]): NotificationsList => {
  const byId = new Map<string, NotificationItem>();
  for (const page of pages) {
    for (const item of page.notifications) {
      if (!byId.has(item.id)) byId.set(item.id, item);
    }
  }
  const notifications = [...byId.values()].sort((a, b) => {
    const time = Date.parse(b.createdAt) - Date.parse(a.createdAt);
    return time || b.id.localeCompare(a.id);
  });
  return { notifications, hasMore: pages.at(-1)?.hasMore ?? false };
};

export const createOptimisticReadState = (state: NotificationsState, id: string): NotificationsState => {
  const next = new Set(state.optimisticReadIds);
  next.add(id);
  return { ...state, optimisticReadIds: next };
};

export const createOptimisticAllReadState = (state: NotificationsState): NotificationsState => {
  const next = new Set(state.optimisticReadIds);
  for (const item of state.items) next.add(item.id);
  return { ...state, optimisticReadIds: next };
};

export const isNotificationRead = (state: NotificationsState, item: NotificationItem): boolean =>
  Boolean(item.readAt) || state.optimisticReadIds.has(item.id);
