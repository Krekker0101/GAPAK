const DB_NAME = 'gapak-security';
const DB_VERSION = 2;
const KEY_STORE = 'crypto-keys';
const COUNTER_STORE = 'message-counters';
const REPLAY_STORE = 'replayed-messages';

export interface StoredDeviceKeys {
  deviceId: string;
  identityKeyId: string;
  identityPrivateKey: CryptoKey;
  agreementPrivateKey: CryptoKey;
  identityPublicJwk: JsonWebKey;
  signingPrivateKey: CryptoKey;
  signingPublicJwk: JsonWebKey;
  agreementPublicJwk: JsonWebKey;
  createdAt: string;
}

const openDb = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(KEY_STORE)) db.createObjectStore(KEY_STORE, { keyPath: 'deviceId' });
    if (!db.objectStoreNames.contains(COUNTER_STORE)) db.createObjectStore(COUNTER_STORE, { keyPath: 'deviceId' });
    if (!db.objectStoreNames.contains(REPLAY_STORE)) db.createObjectStore(REPLAY_STORE, { keyPath: 'key' });
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error('Unable to open secure key storage'));
});

export class DeviceKeyStore {
  async listDeviceIds(): Promise<string[]> {
    if (typeof indexedDB === 'undefined') throw new Error('IndexedDB is required for secure device key storage');
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const request = db.transaction(KEY_STORE, 'readonly').objectStore(KEY_STORE).getAllKeys();
      request.onsuccess = () => resolve(request.result.filter((value): value is string => typeof value === 'string'));
      request.onerror = () => reject(request.error ?? new Error('Unable to enumerate local device keys'));
    });
  }

  async get(deviceId: string): Promise<StoredDeviceKeys | null> {
    if (typeof indexedDB === 'undefined') throw new Error('IndexedDB is required for secure device key storage');
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const request = db.transaction(KEY_STORE, 'readonly').objectStore(KEY_STORE).get(deviceId);
      request.onsuccess = () => resolve((request.result as StoredDeviceKeys | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error('Unable to read device keys'));
    });
  }

  async put(keys: StoredDeviceKeys): Promise<void> {
    if (typeof indexedDB === 'undefined') throw new Error('IndexedDB is required for secure device key storage');
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(KEY_STORE, 'readwrite');
      tx.objectStore(KEY_STORE).put(keys);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Unable to persist device keys'));
    });
  }

  async delete(deviceId: string): Promise<void> {
    if (typeof indexedDB === 'undefined') return;
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([KEY_STORE, COUNTER_STORE, REPLAY_STORE], 'readwrite');
      tx.objectStore(KEY_STORE).delete(deviceId);
      tx.objectStore(COUNTER_STORE).delete(deviceId);
      const replayStore = tx.objectStore(REPLAY_STORE);
      const replayCursor = replayStore.openCursor();
      replayCursor.onsuccess = () => {
        const cursor = replayCursor.result;
        if (!cursor) return;
        const value = cursor.value as { key: string };
        if (value.key.startsWith(`${deviceId}:`)) cursor.delete();
        cursor.continue();
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Unable to destroy device keys'));
    });
  }

  async nextMessageCounter(deviceId: string): Promise<number> {
    if (typeof indexedDB === 'undefined') throw new Error('IndexedDB is required for message sequence persistence');
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(COUNTER_STORE, 'readwrite');
      const store = tx.objectStore(COUNTER_STORE);
      const getRequest = store.get(deviceId);
      let next = 1;
      getRequest.onsuccess = () => {
        const current = Number((getRequest.result as { value?: number } | undefined)?.value ?? 0);
        if (!Number.isSafeInteger(current) || current < 0) {
          tx.abort();
          reject(new Error('Invalid persisted message sequence state'));
          return;
        }
        next = current + 1;
        store.put({ deviceId, value: next });
      };
      tx.oncomplete = () => resolve(next);
      tx.onerror = () => reject(tx.error ?? new Error('Unable to persist message sequence'));
      tx.onabort = () => reject(tx.error ?? new Error('Unable to persist message sequence'));
    });
  }

  async markMessageSeen(deviceId: string, messageId: string): Promise<boolean> {
    if (typeof indexedDB === 'undefined') throw new Error('IndexedDB is required for replay protection');
    const db = await openDb();
    const key = `${deviceId}:${messageId}`;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(REPLAY_STORE, 'readwrite');
      const store = tx.objectStore(REPLAY_STORE);
      const getRequest = store.get(key);
      let alreadySeen = false;
      getRequest.onsuccess = () => {
        alreadySeen = Boolean(getRequest.result);
        if (!alreadySeen) store.put({ key, seenAt: Date.now() });
      };
      tx.oncomplete = () => resolve(!alreadySeen);
      tx.onerror = () => reject(tx.error ?? new Error('Unable to persist replay state'));
      tx.onabort = () => reject(tx.error ?? new Error('Unable to persist replay state'));
    });
  }

  async clear(): Promise<void> {
    if (typeof indexedDB === 'undefined') return;
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([KEY_STORE, COUNTER_STORE, REPLAY_STORE], 'readwrite');
      tx.objectStore(KEY_STORE).clear();
      tx.objectStore(COUNTER_STORE).clear();
      tx.objectStore(REPLAY_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Unable to clear secure key storage'));
    });
  }
}

export const deviceKeyStore = new DeviceKeyStore();
