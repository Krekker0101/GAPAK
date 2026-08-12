import type { NotificationItem, NotificationsList } from '../../shared/api/backendContracts';
import { notificationsApi } from './api/notificationsApi';
import { createOptimisticAllReadState, createOptimisticReadState, mergeNotifications, type NotificationsState } from './notificationsState';

const INITIAL_LIMIT = 20;
const MAX_BACKEND_LIMIT = 50;

export class NotificationsController {
  private pages: NotificationsList[] = [];
  private state: NotificationsState = { items: [], hasMore: false, optimisticReadIds: new Set() };
  private unread = 0;

  getState(): NotificationsState { return this.state; }
  getUnreadCount(): number { return this.unread; }

  async loadInitial(signal?: AbortSignal): Promise<NotificationsState> {
    const [page, unread] = await Promise.all([
      notificationsApi.list({ limit: INITIAL_LIMIT }, signal),
      notificationsApi.unreadCount(signal),
    ]);
    this.pages = [page];
    this.state = { items: page.notifications, hasMore: page.hasMore, optimisticReadIds: new Set() };
    this.unread = unread.count;
    return this.state;
  }

  async loadMore(signal?: AbortSignal): Promise<NotificationsState> {
    if (!this.state.hasMore) return this.state;
    // The backend contract exposes only `limit`, not offset/cursor. We can safely
    // expand the first page up to the server's documented maximum, but must not
    // invent a cursor or pretend that a second page exists beyond that limit.
    const current = this.state.items.length;
    if (current >= MAX_BACKEND_LIMIT) {
      this.state = { ...this.state, hasMore: false };
      return this.state;
    }
    const page = await notificationsApi.list({ limit: MAX_BACKEND_LIMIT }, signal);
    this.pages = [page];
    const merged = mergeNotifications(page);
    this.state = { ...this.state, items: merged.notifications, hasMore: page.hasMore };
    return this.state;
  }

  async markRead(id: string, signal?: AbortSignal): Promise<NotificationsState> {
    const previous = this.state;
    const wasRead = previous.items.find((item) => item.id === id)?.readAt || previous.optimisticReadIds.has(id);
    if (!wasRead) {
      this.state = createOptimisticReadState(previous, id);
      this.unread = Math.max(0, this.unread - 1);
    }
    try {
      await notificationsApi.markRead(id, signal);
      const refreshed = await notificationsApi.list({ limit: Math.max(INITIAL_LIMIT, this.state.items.length) }, signal);
      this.pages = [refreshed];
      this.state = { items: refreshed.notifications, hasMore: refreshed.hasMore, optimisticReadIds: new Set() };
      return this.state;
    } catch (error) {
      this.state = previous;
      if (!wasRead) this.unread += 1;
      throw error;
    }
  }

  async markAllRead(signal?: AbortSignal): Promise<NotificationsState> {
    const previous = this.state;
    const previousUnread = this.unread;
    this.state = createOptimisticAllReadState(previous);
    this.unread = 0;
    try {
      await notificationsApi.markAllRead(signal);
      const refreshed = await notificationsApi.list({ limit: Math.max(INITIAL_LIMIT, this.state.items.length) }, signal);
      this.pages = [refreshed];
      this.state = { items: refreshed.notifications, hasMore: refreshed.hasMore, optimisticReadIds: new Set() };
      const count = await notificationsApi.unreadCount(signal);
      this.unread = count.count;
      return this.state;
    } catch (error) {
      this.state = previous;
      this.unread = previousUnread;
      throw error;
    }
  }

  reconcileRealtime(_notification: NotificationItem): NotificationsState {
    // Backend WS contract currently exposes no notification event. This method is
    // intentionally not wired to fabricated event names. HTTP remains the source
    // of truth until the backend publishes a documented notification event.
    return this.state;
  }
}
