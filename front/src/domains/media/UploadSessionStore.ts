import { MediaUsageContext } from '../../shared/types/media';

/**
 * Durable metadata for a resumable upload session, persisted so an interrupted
 * multipart upload can be reconciled with the server after a page reload.
 *
 * Deliberately excludes the `File` object: browsers cannot serialize an open
 * `File`/`Blob` handle into IndexedDB reliably across a reload, and doing so
 * would silently corrupt or lose data. The user must re-select the source file;
 * this store only remembers *what* was being uploaded and *how far it got*, so
 * the reselected file can be verified (name/size/hash) before resuming.
 */
export interface PersistedUploadPart {
  partNumber: number;
  etag: string;
}

export interface PersistedUploadSession {
  /** Client-local session id — matches the in-memory UploadSession.id. */
  id: string;
  /** Server-issued upload session id. */
  uploadId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  context: MediaUsageContext;
  /** SHA-256 hex digest of the original file, computed once at session start. */
  contentHash: string;
  chunkSizeBytes?: number;
  totalParts?: number;
  completedParts: PersistedUploadPart[];
  /** Bytes already durably accepted by the server, derived from completedParts. */
  offsetBytes: number;
  /** Server-issued expiry for the current upload session grant. */
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

const DB_NAME = 'gapak-media';
const DB_VERSION = 1;
const STORE = 'upload-sessions';

const openDb = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'id' });
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error('Unable to open durable upload-session store'));
});

const isIndexedDbAvailable = (): boolean => typeof indexedDB !== 'undefined';

export const uploadSessionStore = {
  async save(session: PersistedUploadSession): Promise<void> {
    if (!isIndexedDbAvailable()) return;
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(session);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Unable to persist upload session'));
    });
  },

  async getAll(): Promise<PersistedUploadSession[]> {
    if (!isIndexedDbAvailable()) return [];
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
      request.onsuccess = () => resolve(request.result as PersistedUploadSession[]);
      request.onerror = () => reject(request.error ?? new Error('Unable to read upload-session store'));
    });
  },

  async get(id: string): Promise<PersistedUploadSession | undefined> {
    if (!isIndexedDbAvailable()) return undefined;
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
      request.onsuccess = () => resolve(request.result as PersistedUploadSession | undefined);
      request.onerror = () => reject(request.error ?? new Error('Unable to read upload session'));
    });
  },

  async remove(id: string): Promise<void> {
    if (!isIndexedDbAvailable()) return;
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Unable to remove upload session'));
    });
  },
};
