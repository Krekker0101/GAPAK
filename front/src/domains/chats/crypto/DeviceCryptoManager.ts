import { deviceKeyStore, StoredDeviceKeys } from '../../../shared/security/deviceKeyStore';
import { bytesToHex, sha256Hex } from '../../../shared/security/hex';

export interface LocalCryptoIdentity {
  deviceId: string;
  identityKeyId: string;
  identityPublicJwk: JsonWebKey;
  agreementPublicJwk: JsonWebKey;
  signingPublicJwk: JsonWebKey;
  fingerprint: string;
}

export const generateDeviceKeys = async (deviceId: string): Promise<StoredDeviceKeys> => {
  const agreement = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const signing = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const identity = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);

  const identityPublicJwk = await crypto.subtle.exportKey('jwk', identity.publicKey);
  const signingPublicJwk = await crypto.subtle.exportKey('jwk', signing.publicKey);
  const agreementPublicJwk = await crypto.subtle.exportKey('jwk', agreement.publicKey);
  // Web Crypto applies the extractable flag to a generated key pair. Export the public
  // metadata once, then immediately re-import private JWK material as non-extractable
  // before persisting it. The private JWK never leaves this function or IndexedDB.
  const identityPrivateJwk = await crypto.subtle.exportKey('jwk', identity.privateKey);
  const signingPrivateJwk = await crypto.subtle.exportKey('jwk', signing.privateKey);
  const agreementPrivateJwk = await crypto.subtle.exportKey('jwk', agreement.privateKey);
  const identityPrivateKey = await crypto.subtle.importKey('jwk', identityPrivateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const signingPrivateKey = await crypto.subtle.importKey('jwk', signingPrivateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const agreementPrivateKey = await crypto.subtle.importKey('jwk', agreementPrivateJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
  return {
    deviceId,
    identityKeyId: `${deviceId}:identity:v1`,
    identityPrivateKey,
    agreementPrivateKey,
    identityPublicJwk: { ...identityPublicJwk, key_ops: ['verify'] },
    signingPrivateKey,
    signingPublicJwk: { ...signingPublicJwk, key_ops: ['verify'] },
    agreementPublicJwk,
    createdAt: new Date().toISOString(),
  };
};

export class DeviceCryptoManager {
  private cache = new Map<string, StoredDeviceKeys>();

  async ensure(deviceId: string): Promise<StoredDeviceKeys> {
    const cached = this.cache.get(deviceId);
    if (cached) return cached;
    const stored = await deviceKeyStore.get(deviceId);
    if (stored?.agreementPublicJwk && stored.agreementPrivateKey) {
      this.cache.set(deviceId, stored);
      return stored;
    }
    const created = await generateDeviceKeys(deviceId);
    await deviceKeyStore.put(created);
    this.cache.set(deviceId, created);
    return created;
  }

  async getIdentity(deviceId: string): Promise<LocalCryptoIdentity> {
    const keys = await this.ensure(deviceId);
    const fingerprint = await sha256Hex(JSON.stringify({ identity: keys.identityPublicJwk, agreement: keys.agreementPublicJwk, signing: keys.signingPublicJwk }));
    return {
      deviceId,
      identityKeyId: keys.identityKeyId,
      identityPublicJwk: keys.identityPublicJwk,
      agreementPublicJwk: keys.agreementPublicJwk,
      signingPublicJwk: keys.signingPublicJwk,
      fingerprint,
    };
  }

  async sign(deviceId: string, data: Uint8Array): Promise<string> {
    const keys = await this.ensure(deviceId);
    const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keys.signingPrivateKey, data);
    return bytesToHex(new Uint8Array(signature));
  }

  async deriveMessageKey(deviceId: string, recipientPublicJwk: JsonWebKey, salt: Uint8Array, info: Uint8Array): Promise<CryptoKey> {
    const keys = await this.ensure(deviceId);
    const recipientPublic = await crypto.subtle.importKey('jwk', recipientPublicJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const sharedBits = await crypto.subtle.deriveBits({ name: 'ECDH', public: recipientPublic }, keys.agreementPrivateKey, 256);
    const hkdfBase = await crypto.subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt, info }, hkdfBase, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }

  async decryptWithAgreement(deviceId: string, ephemeralPublicJwk: JsonWebKey, salt: Uint8Array, info: Uint8Array): Promise<CryptoKey> {
    const keys = await this.ensure(deviceId);
    const ephemeralPublic = await crypto.subtle.importKey('jwk', ephemeralPublicJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const privateAgreement = keys.agreementPrivateKey;
    if (!privateAgreement) throw new Error('Device agreement private key is unavailable; key storage must be re-enrolled');
    const sharedBits = await crypto.subtle.deriveBits({ name: 'ECDH', public: ephemeralPublic }, privateAgreement, 256);
    const hkdfBase = await crypto.subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt, info }, hkdfBase, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }

  async replace(deviceId: string, keys: StoredDeviceKeys): Promise<void> {
    await deviceKeyStore.put(keys);
    this.cache.set(deviceId, keys);
  }

  async destroy(deviceId: string): Promise<void> {
    this.cache.delete(deviceId);
    await deviceKeyStore.delete(deviceId);
  }

  async destroyAll(): Promise<void> {
    this.cache.clear();
    await deviceKeyStore.clear();
  }
}

export const deviceCryptoManager = new DeviceCryptoManager();
