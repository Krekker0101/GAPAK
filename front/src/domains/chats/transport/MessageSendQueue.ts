import { chatsApi, SendMessageRequest } from '../api/chatsApi';

interface QueuedMessage { chatId: string; request: SendMessageRequest; queuedAt: number }

/** Bounded in-memory offline queue. It intentionally does not persist plaintext or crypto material to localStorage. */
class MessageSendQueue {
  private queue: QueuedMessage[] = [];
  private flushing = false;
  private readonly maxItems = 100;

  enqueue(chatId: string, request: SendMessageRequest): void {
    if (this.queue.some((item) => item.request.clientMessageId === request.clientMessageId)) return;
    if (this.queue.length >= this.maxItems) this.queue.shift();
    this.queue.push({ chatId, request, queuedAt: Date.now() });
  }

  async flush(onSuccess: (chatId: string, message: Awaited<ReturnType<typeof chatsApi.sendMessage>>) => void, onFailure: (chatId: string, request: SendMessageRequest, error: unknown) => void): Promise<void> {
    if (this.flushing || !this.queue.length || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
    this.flushing = true;
    try {
      while (this.queue.length) {
        const item = this.queue[0];
        try {
          const message = await chatsApi.sendMessage(item.chatId, item.request);
          this.queue.shift();
          onSuccess(item.chatId, message);
        } catch (error) {
          onFailure(item.chatId, item.request, error);
          break;
        }
      }
    } finally { this.flushing = false; }
  }
}
export const messageSendQueue = new MessageSendQueue();
