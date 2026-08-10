const DB_NAME = 'gapak-security';
const DB_VERSION = 1;
const STORE = 'crypto-keys';

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
    if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'deviceId' });
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error('Unable to open secure key storage'));
});

export class DeviceKeyStore {
  async get(deviceId: string): Promise<StoredDeviceKeys | null> {
    if (typeof indexedDB === 'undefined') throw new Error('IndexedDB is required for secure device key storage');
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(deviceId);
      request.onsuccess = () => resolve((request.result as StoredDeviceKeys | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error('Unable to read device keys'));
    });
  }

  async put(keys: StoredDeviceKeys): Promise<void> {
    if (typeof indexedDB === 'undefined') throw new Error('IndexedDB is required for secure device key storage');
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(keys);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Unable to persist device keys'));
    });
  }

  async delete(deviceId: string): Promise<void> {
    if (typeof indexedDB === 'undefined') return;
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(deviceId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Unable to destroy device keys'));
    });
  }

  async clear(): Promise<void> {
    if (typeof indexedDB === 'undefined') return;
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Unable to clear secure key storage'));
    });
  }
}

export const deviceKeyStore = new DeviceKeyStore();
