import { chatsApi } from '../api/chatsApi';

class ReceiptsBatcherService {
  private pendingRead = new Map<string, Set<string>>();
  private pendingDelivery = new Map<string, Set<string>>();
  private timer: ReturnType<typeof setInterval> | null = null;

  start(): void { if (!this.timer) this.timer = setInterval(() => void this.flush(), 1500); }
  stop(): void { if (this.timer) clearInterval(this.timer); this.timer = null; this.pendingRead.clear(); this.pendingDelivery.clear(); }
  markAsRead(chatId: string, messageId: string): void { const set = this.pendingRead.get(chatId) ?? new Set<string>(); set.add(messageId); this.pendingRead.set(chatId, set); }
  markAsDelivered(chatId: string, messageId: string): void { const set = this.pendingDelivery.get(chatId) ?? new Set<string>(); set.add(messageId); this.pendingDelivery.set(chatId, set); }

  async flush(): Promise<void> {
    await Promise.all([
      this.flushMap(this.pendingRead, (messageId) => chatsApi.markAsRead(messageId)),
      this.flushMap(this.pendingDelivery, (messageId) => chatsApi.markAsDelivered(messageId)),
    ]);
  }

  private async flushMap(pending: Map<string, Set<string>>, send: (messageId: string) => Promise<unknown>): Promise<void> {
    const requests: Promise<void>[] = [];
    pending.forEach((ids, chatId) => {
      for (const messageId of [...ids]) {
        requests.push(send(messageId).then(() => {
          ids.delete(messageId);
          if (!ids.size) pending.delete(chatId);
        }).catch(() => undefined));
      }
    });
    await Promise.all(requests);
  }
}

export const receiptsBatcher = new ReceiptsBatcherService();
