import { QueryClient } from '@tanstack/react-query';
import { RealtimeEvent } from './types';

export class RealtimeEventRouter {
  private handlers = new Map<string, Set<(event: RealtimeEvent) => void>>();
  private processed = new Set<string>();
  private latestVersion = new Map<string, number>();

  constructor(private readonly queryClient: QueryClient) {}

  subscribe(type: string, handler: (event: RealtimeEvent) => void): () => void {
    const set = this.handlers.get(type) ?? new Set();
    set.add(handler);
    this.handlers.set(type, set);
    return () => {
      set.delete(handler);
      if (!set.size) this.handlers.delete(type);
    };
  }

  route(event: RealtimeEvent): boolean {
    if (this.processed.has(event.id)) return false;

    const streamKey = `${event.type}:${event.chatId ?? 'global'}`;
    if (typeof event.version === 'number') {
      const previous = this.latestVersion.get(streamKey);
      if (previous !== undefined && event.version <= previous) return false;
      this.latestVersion.set(streamKey, event.version);
    }

    this.processed.add(event.id);
    if (this.processed.size > 5000) {
      const oldest = this.processed.values().next().value;
      if (oldest) this.processed.delete(oldest);
    }

    this.handlers.get(event.type)?.forEach((handler) => handler(event));
    this.handlers.get('*')?.forEach((handler) => handler(event));
    this.project(event);
    return true;
  }

  clearHistory(): void {
    this.processed.clear();
    this.latestVersion.clear();
  }

  private project(event: RealtimeEvent): void {
    const payload = event.payload as Record<string, unknown> | undefined;
    const chatId = event.chatId ?? (typeof payload?.chatId === 'string' ? payload.chatId : undefined);

    switch (event.type) {
      case 'message.new':
      case 'message.updated':
      case 'message.deleted':
      case 'message.status':
      case 'message.ack':
        if (chatId) this.queryClient.invalidateQueries({ queryKey: ['chat', 'messages', chatId] });
        this.queryClient.invalidateQueries({ queryKey: ['chats'] });
        break;
      case 'notification.new':
      case 'notification.updated':
        this.queryClient.invalidateQueries({ queryKey: ['notifications'] });
        this.queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
        break;
      case 'presence.update': {
        const userId = typeof payload?.userId === 'string' ? payload.userId : undefined;
        if (userId) this.queryClient.setQueryData(['presence', userId], payload);
        break;
      }
      case 'connection.update':
        this.queryClient.invalidateQueries({ queryKey: ['connections'] });
        break;
      case 'story.update':
        this.queryClient.invalidateQueries({ queryKey: ['stories'] });
        break;
      case 'live.update':
      case 'live.chat.message':
        this.queryClient.invalidateQueries({ queryKey: ['live'] });
        break;
      case 'security.alert':
        this.queryClient.invalidateQueries({ queryKey: ['security'] });
        break;
      default:
        break;
    }
  }
}
