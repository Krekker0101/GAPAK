import { ApiError } from '../../../shared/api/httpClient';
import { chatsApi, SendMessageRequest } from '../api/chatsApi';

interface QueuedMessage {
  id: string;
  chatId: string;
  request: SendMessageRequest;
  queuedAt: number;
}

const DB_NAME = 'gapak-messaging';
const DB_VERSION = 1;
const STORE = 'outbound-encrypted-messages';
const MAX_ITEMS = 100;
const MAX_BYTES = 10 * 1024 * 1024;

const openDb = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'id' });
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error('Unable to open durable message queue'));
});

const readAll = async (): Promise<QueuedMessage[]> => {
  if (typeof indexedDB === 'undefined') throw new Error('IndexedDB is required for durable offline messaging');
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    request.onsuccess = () => resolve((request.result as QueuedMessage[]).sort((a, b) => a.queuedAt - b.queuedAt));
    request.onerror = () => reject(request.error ?? new Error('Unable to read outbound message queue'));
  });
};

const put = async (item: QueuedMessage): Promise<void> => {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Unable to persist outbound message'));
  });
};

const remove = async (id: string): Promise<void> => {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Unable to remove outbound message'));
  });
};

const isRetryableSendError = (error: unknown): boolean => {
  if (error instanceof ApiError) return error.status === 0 || error.status === 408 || error.status === 425 || error.status === 429 || error.status >= 500;
  return error instanceof TypeError || (typeof navigator !== 'undefined' && !navigator.onLine);
};

/**
 * Durable queue for already-encrypted message envelopes only.
 * Plaintext is never accepted by this store. Queue capacity is bounded by count and bytes;
 * overflow is an explicit error, never silent eviction.
 */
export class MessageSendQueue {
  async enqueue(chatId: string, request: SendMessageRequest): Promise<void> {
    if (!request.ciphertext || request.content !== undefined) throw new Error('Offline queue accepts encrypted envelopes only and never persists plaintext content');
    const item: QueuedMessage = { id: request.clientMessageId, chatId, request, queuedAt: Date.now() };
    const existing = await readAll();
    if (existing.some((queued) => queued.id === item.id)) return;
    const serialized = JSON.stringify(item);
    const currentBytes = existing.reduce((sum, queued) => sum + JSON.stringify(queued).length, 0);
    if (existing.length >= MAX_ITEMS || currentBytes + serialized.length > MAX_BYTES) {
      throw new Error('Offline message queue is full. The message was not discarded; keep the app open and retry after queued messages are delivered.');
    }
    await put(item);
  }

  async flush(
    onSuccess: (chatId: string, message: Awaited<ReturnType<typeof chatsApi.sendMessage>>) => void,
    onFailure: (chatId: string, request: SendMessageRequest, error: unknown) => void,
  ): Promise<void> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    const items = await readAll();
    for (const item of items) {
      try {
        const message = await chatsApi.sendMessage(item.chatId, item.request);
        await remove(item.id);
        onSuccess(item.chatId, message);
      } catch (error) {
        onFailure(item.chatId, item.request, error);
        if (isRetryableSendError(error)) break;
        // Permanent failures remain persisted so the UI can surface them and the queue can continue.
        // A malformed/forbidden message must not block unrelated later messages.
        continue;
      }
    }
  }

  async pendingCount(): Promise<number> {
    return (await readAll()).length;
  }
}

export const messageSendQueue = new MessageSendQueue();
