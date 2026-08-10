import { realtimeManager } from '../../../shared/realtime/RealtimeManager';

class ReceiptsBatcherService {
  private pendingRead = new Map<string, Set<string>>();
  private pendingDelivery = new Map<string, Set<string>>();
  private timer: ReturnType<typeof setInterval> | null = null;

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.flush(), 1500);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.pendingRead.clear();
    this.pendingDelivery.clear();
  }

  markAsRead(chatId: string, messageId: string): void {
    const set = this.pendingRead.get(chatId) ?? new Set<string>();
    set.add(messageId);
    this.pendingRead.set(chatId, set);
  }

  markAsDelivered(chatId: string, messageId: string): void {
    const set = this.pendingDelivery.get(chatId) ?? new Set<string>();
    set.add(messageId);
    this.pendingDelivery.set(chatId, set);
  }

  flush(): void {
    const now = new Date().toISOString();
    this.flushMap(this.pendingRead, (chatId, messageIds) => ({
      id: crypto.randomUUID(),
      type: 'receipt.update',
      chatId,
      timestamp: now,
      payload: { chatId, messageIds, status: 'read', readAt: now },
    }));
    this.flushMap(this.pendingDelivery, (chatId, messageIds) => ({
      id: crypto.randomUUID(),
      type: 'receipt.update',
      chatId,
      timestamp: now,
      payload: { chatId, messageIds, status: 'delivered', deliveredAt: now },
    }));
  }

  private flushMap(
    pending: Map<string, Set<string>>,
    buildEvent: (chatId: string, messageIds: string[]) => Parameters<typeof realtimeManager.send>[0],
  ): void {
    pending.forEach((ids, chatId) => {
      if (!ids.size) return;
      const messageIds = [...ids];
      const sent = realtimeManager.send(buildEvent(chatId, messageIds));
      if (sent) pending.delete(chatId);
    });
  }
}

export const receiptsBatcher = new ReceiptsBatcherService();
