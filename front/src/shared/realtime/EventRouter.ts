import type { QueryClient } from '@tanstack/react-query';
import { telemetry } from '../telemetry/telemetry';
import type { RealtimeEvent } from './types';

export class RealtimeEventRouter {
  private handlers = new Map<string, Set<(event: RealtimeEvent) => void>>();
  private processedEventIds = new Map<string, number>();
  private processedMessageIds = new Map<string, number>();
  private latestSequence = new Map<string, number>();
  private readonly processedTtlMs = 10 * 60_000;
  private readonly maxProcessed = 10_000;
  private readonly queryClient: QueryClient;

  constructor(queryClient: QueryClient) {
    this.queryClient = queryClient;
  }

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
    const now = Date.now();
    this.prune(now);

    if (event.kind === 'event') {
      if (this.processedEventIds.has(event.eventId)) return false;
      this.processedEventIds.set(event.eventId, now);

      if (event.messageId && event.chatId && event.type.startsWith('chat.message.')) {
        const key = `${event.chatId}:${event.messageId}:${event.type}`;
        if (this.processedMessageIds.has(key)) return false;
        this.processedMessageIds.set(key, now);
      }

      if (event.chatId && typeof event.sequence === 'number') {
        const previous = this.latestSequence.get(event.chatId);
        // Edits and deletions retain the original message sequence. Only a
        // duplicate/stale creation is invalid by sequence; mutation events are
        // deduplicated by their durable event IDs above.
        if (event.type === 'chat.message.created' && previous !== undefined && event.sequence <= previous) return false;
        if (previous === undefined || event.sequence > previous) this.latestSequence.set(event.chatId, event.sequence);
      }
    }

    const handlerType = event.kind === 'history'
      ? 'history'
      : event.kind === 'ack'
        ? event.type
        : event.kind === 'error'
          ? 'error'
          : event.type;

    this.invoke(handlerType, event);
    this.invoke('*', event);
    this.project(event);
    return true;
  }

  clearHistory(): void {
    this.processedEventIds.clear();
    this.processedMessageIds.clear();
    this.latestSequence.clear();
  }

  private invoke(type: string, event: RealtimeEvent): void {
    this.handlers.get(type)?.forEach((handler) => {
      try {
        handler(event);
      } catch (error) {
        telemetry.trackError('Realtime handler failed', error, { eventType: type });
      }
    });
  }

  private project(event: RealtimeEvent): void {
    if (event.kind === 'history') {
      const chatIds = new Set(event.messages.map((message) => message.chatId));
      chatIds.forEach((chatId) => this.queryClient.invalidateQueries({ queryKey: ['chat', 'messages', chatId] }));
      return;
    }

    if (event.kind === 'event') {
      if (event.chatId) {
        this.queryClient.invalidateQueries({ queryKey: ['chat', 'messages', event.chatId] });
        if (event.type === 'chat.pin.changed') this.queryClient.invalidateQueries({ queryKey: ['chat', 'pinned', event.chatId] });
      }
      this.queryClient.invalidateQueries({ queryKey: ['chats'] });
    }
  }

  private prune(now: number): void {
    for (const [id, seenAt] of this.processedEventIds) {
      if (now - seenAt > this.processedTtlMs) this.processedEventIds.delete(id);
    }
    for (const [id, seenAt] of this.processedMessageIds) {
      if (now - seenAt > this.processedTtlMs) this.processedMessageIds.delete(id);
    }

    while (this.processedEventIds.size > this.maxProcessed) {
      const oldest = this.processedEventIds.keys().next().value;
      if (oldest) this.processedEventIds.delete(oldest);
      else break;
    }
  }
}
