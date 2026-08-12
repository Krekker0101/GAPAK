import { realtimeManager } from '../../../shared/realtime/RealtimeManager';

class ReceiptsBatcherService {
  private pendingRead = new Map<string, Set<string>>();
  private pendingDelivery = new Map<string, Set<string>>();
  private timer: ReturnType<typeof setInterval> | null = null;

  start(): void { if (!this.timer) this.timer = setInterval(() => this.flush(), 1500); }
  stop(): void { if (this.timer) clearInterval(this.timer); this.timer = null; this.pendingRead.clear(); this.pendingDelivery.clear(); }
  markAsRead(chatId: string, messageId: string): void { const set = this.pendingRead.get(chatId) ?? new Set<string>(); set.add(messageId); this.pendingRead.set(chatId, set); }
  markAsDelivered(chatId: string, messageId: string): void { const set = this.pendingDelivery.get(chatId) ?? new Set<string>(); set.add(messageId); this.pendingDelivery.set(chatId, set); }

  flush(): void {
    this.flushMap(this.pendingRead, (chatId, messageId) => ({ type: 'read_receipt', data: { chat_id: chatId, message_id: messageId } }));
    this.flushMap(this.pendingDelivery, (chatId, messageId) => ({ type: 'delivery_ack', data: { chat_id: chatId, message_id: messageId } }));
  }

  private flushMap(pending: Map<string, Set<string>>, build: (chatId: string, messageId: string) => Parameters<typeof realtimeManager.send>[0]): void {
    pending.forEach((ids, chatId) => {
      for (const messageId of ids) {
        if (realtimeManager.send(build(chatId, messageId))) ids.delete(messageId);
      }
      if (!ids.size) pending.delete(chatId);
    });
  }
}

export const receiptsBatcher = new ReceiptsBatcherService();
