/**
 * GAPAK cryptographic foundation.
 *
 * Uses browser Web Crypto primitives only:
 * - ECDH P-256 for ephemeral key agreement
 * - HKDF-SHA-256 for key derivation
 * - AES-256-GCM for authenticated encryption
 * - ECDSA P-256/SHA-256 for device-level message signatures
 * - IndexedDB non-extractable private keys via DeviceCryptoManager
 *
 * IMPORTANT: this file does NOT claim to implement Signal/Double-Ratchet.
 * Full E2EE is only achieved when the GAPAK backend authenticates device keys,
 * supplies verified recipient bundles, enforces replay protection/counters,
 * rotates keys, and rejects revoked devices. Those are explicit backend contracts.
 */

import { E2EEMessageEnvelope, ChatMessage, EncryptedAttachment, MessageContentType } from '../../../shared/types';
import { bytesToHex, canonicalJson, hexToBytes, randomHex, sha256Hex, utf8, utf8Decode } from '../../../shared/security/hex';
import { deviceCryptoManager, generateDeviceKeys } from './DeviceCryptoManager';
import { cryptoApi } from '../api/cryptoApi';
import { RecipientKeyBundle } from './CryptoProtocol';

export class DecryptionError extends Error {
  constructor(message: string) { super(message); this.name = 'DecryptionError'; }
}

const importEcdhPublic = (jwk: JsonWebKey) => crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, false, []);

const deriveAesKey = async (privateKey: CryptoKey, publicKeyJwk: JsonWebKey, salt: Uint8Array, info: Uint8Array): Promise<CryptoKey> => {
  const publicKey = await importEcdhPublic(publicKeyJwk);
  const sharedBits = await crypto.subtle.deriveBits({ name: 'ECDH', public: publicKey }, privateKey, 256);
  const hkdfBase = await crypto.subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt, info }, hkdfBase, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
};

const encryptWithKey = async (key: CryptoKey, plaintext: Uint8Array, aad: Uint8Array) => {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad, tagLength: 128 }, key, plaintext);
  return { iv: bytesToHex(iv), ciphertext: bytesToHex(new Uint8Array(encrypted)) };
};

const decryptWithKey = async (key: CryptoKey, ciphertext: string, ivHex: string, aad: Uint8Array) => {
  try {
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: hexToBytes(ivHex), additionalData: aad, tagLength: 128 }, key, hexToBytes(ciphertext));
    return new Uint8Array(plaintext);
  } catch {
    throw new DecryptionError('Authenticated decryption failed');
  }
};

const canonicalEnvelopeData = (envelope: Pick<E2EEMessageEnvelope, 'id'|'chatId'|'senderId'|'senderKeyId'|'ciphertext'|'nonce'|'keyEnvelopes'|'ratchetCounter'|'contentType'|'createdAt'|'expiresAt'|'replyToMessageId'>) =>
  utf8(canonicalJson(envelope));

class E2EECryptoEngineService {
  async ensureDevice(deviceId: string) {
    const identity = await deviceCryptoManager.getIdentity(deviceId);
    return identity;
  }

  async rotateCurrentDevice(deviceId: string) {
    const freshKeys = await generateDeviceKeys(deviceId);
    const identity = {
      deviceId,
      identityKeyId: `${deviceId}:identity:${Date.now()}`,
      identityPublicJwk: freshKeys.identityPublicJwk,
      agreementPublicJwk: freshKeys.agreementPublicJwk,
      signingPublicJwk: freshKeys.signingPublicJwk,
    };
    const result = await cryptoApi.rotateCurrentDevice(identity);
    freshKeys.identityKeyId = identity.identityKeyId;
    await deviceCryptoManager.replace(deviceId, freshKeys);
    return result;
  }

  async registerCurrentDevice(deviceId: string, deviceName = 'GAPAK Web Device') {
    const identity = await this.ensureDevice(deviceId);
    return cryptoApi.registerCurrentDevice({
      deviceId,
      deviceName,
      deviceType: 'web',
      identityKeyId: identity.identityKeyId,
      agreementPublicKey: identity.agreementPublicJwk,
      signingPublicKey: identity.signingPublicJwk,
    });
  }

  async generateSafetyNumber(keyA: string, keyB: string): Promise<string> {
    const digest = await sha256Hex([keyA, keyB].sort().join(':'));
    return `${digest.slice(0, 4)} ${digest.slice(4, 8)} ${digest.slice(8, 12)} ${digest.slice(12, 16)} ${digest.slice(16, 20)} ${digest.slice(20, 24)}`;
  }

  async encryptMessage(params: {
    chatId: string;
    senderId: string;
    senderDeviceId: string;
    plaintext: string;
    contentType: MessageContentType;
    recipientUserIds: string[];
    replyToMessageId?: string;
    expiresAt?: string;
    attachments?: EncryptedAttachment[];
  }): Promise<E2EEMessageEnvelope> {
    const senderIdentity = await this.ensureDevice(params.senderDeviceId);
    const bundles = await cryptoApi.recipientBundles(params.recipientUserIds);
    const usable = bundles.filter((bundle) => bundle.verificationStatus !== 'changed');
    if (usable.length !== params.recipientUserIds.length) throw new Error('Verified recipient device keys are required before sending an encrypted message.');
    if (usable.length === 0) throw new Error('No recipient encryption devices are available.');

    const ephemeral = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const ephemeralPublicKey = await crypto.subtle.exportKey('jwk', ephemeral.publicKey);
    const messageId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const messageKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    const messageKeyRaw = new Uint8Array(await crypto.subtle.exportKey('raw', messageKey));
    const messageIv = new Uint8Array(12);
    crypto.getRandomValues(messageIv);
    const aad = utf8(canonicalJson({ chatId: params.chatId, senderId: params.senderId, senderKeyId: senderIdentity.identityKeyId, messageId, contentType: params.contentType, createdAt }));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: messageIv, additionalData: aad, tagLength: 128 }, messageKey, utf8(params.plaintext));

    const keyEnvelopes: Record<string, string> = {};
    for (const bundle of usable) {
      const salt = new Uint8Array(32);
      crypto.getRandomValues(salt);
      const info = utf8(`gapak-e2ee-v1|wrap|${params.chatId}|${messageId}|${bundle.deviceId}`);
      const wrappingKey = await deriveAesKey(ephemeral.privateKey, bundle.agreementPublicKey, salt, info);
      const wrapped = await encryptWithKey(wrappingKey, messageKeyRaw, utf8(canonicalJson({ chatId: params.chatId, messageId, recipientDeviceId: bundle.deviceId })));
      keyEnvelopes[bundle.deviceId] = JSON.stringify({ recipientDeviceId: bundle.deviceId, recipientUserId: bundle.userId, ephemeralPublicKey, salt: bytesToHex(salt), wrappedKey: wrapped.ciphertext, wrappedIv: wrapped.iv, identityKeyId: bundle.identityKeyId });
    }

    const envelopeBase = {
      protocolVersion: 'gapak-e2ee-v1' as const,
      id: messageId,
      chatId: params.chatId,
      senderId: params.senderId,
      senderKeyId: senderIdentity.identityKeyId,
      content: null as null,
      ciphertext: bytesToHex(new Uint8Array(ciphertext)),
      nonce: bytesToHex(messageIv),
      keyEnvelopes,
      ratchetCounter: 0,
      authenticationTag: 'signature-v1',
      attachments: params.attachments || [],
      contentType: params.contentType,
      createdAt,
      expiresAt: params.expiresAt,
      replyToMessageId: params.replyToMessageId,
    };
    const signature = await deviceCryptoManager.sign(params.senderDeviceId, canonicalEnvelopeData(envelopeBase));
    return { ...envelopeBase, authenticationTag: signature };
  }

  async decryptMessage(envelope: E2EEMessageEnvelope, senderProfile: any, targetDeviceId: string, senderSigningPublicJwk: JsonWebKey): Promise<ChatMessage> {
    if (envelope.content !== null) throw new DecryptionError('Plaintext content is forbidden on the wire');
    const signingKey = await crypto.subtle.importKey('jwk', senderSigningPublicJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const verified = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, signingKey, hexToBytes(envelope.authenticationTag), canonicalEnvelopeData(envelope));
    if (!verified) throw new DecryptionError('Message signature verification failed');
    const recipientEnvelopeRaw = envelope.keyEnvelopes[targetDeviceId];
    if (!recipientEnvelopeRaw) throw new DecryptionError('No encrypted recipient envelope exists for this device');
    const recipientEnvelope = JSON.parse(recipientEnvelopeRaw) as { ephemeralPublicKey: JsonWebKey; salt: string; wrappedKey: string; wrappedIv: string };
    const info = utf8(`gapak-e2ee-v1|wrap|${envelope.chatId}|${envelope.id}|${targetDeviceId}`);
    const keys = await deviceCryptoManager.ensure(targetDeviceId);
    const wrappingKey = await deriveAesKey(keys.agreementPrivateKey, recipientEnvelope.ephemeralPublicKey, hexToBytes(recipientEnvelope.salt), info);
    const wrappedKeyPlaintext = await decryptWithKey(wrappingKey, recipientEnvelope.wrappedKey, recipientEnvelope.wrappedIv, utf8(canonicalJson({ chatId: envelope.chatId, messageId: envelope.id, recipientDeviceId: targetDeviceId })));
    const messageKey = await crypto.subtle.importKey('raw', wrappedKeyPlaintext, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    const aad = utf8(canonicalJson({ chatId: envelope.chatId, senderId: envelope.senderId, senderKeyId: envelope.senderKeyId, messageId: envelope.id, contentType: envelope.contentType, createdAt: envelope.createdAt }));
    const plaintext = await decryptWithKey(messageKey, envelope.ciphertext, envelope.nonce, aad);
    return {
      id: envelope.id,
      chatId: envelope.chatId,
      sender: senderProfile,
      senderKeyId: envelope.senderKeyId,
      content: utf8Decode(plaintext),
      contentType: envelope.contentType || 'TEXT',
      state: 'delivered',
      createdAt: envelope.createdAt,
      expiresAt: envelope.expiresAt,
      reactions: [],
      attachments: envelope.attachments || [],
    };
  }

  async encryptAttachment(file: File): Promise<EncryptedAttachment> {
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    const iv = new Uint8Array(12);
    crypto.getRandomValues(iv);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes);
    const encryptedBlob = new Blob([encrypted], { type: 'application/octet-stream' });
    const encryptedBlobUrl = URL.createObjectURL(encryptedBlob);
    const exportedKey = await crypto.subtle.exportKey('raw', key);
    let type: EncryptedAttachment['type'] = 'document';
    if (file.type.startsWith('image/')) type = 'image';
    else if (file.type.startsWith('video/')) type = 'video';
    else if (file.type.startsWith('audio/')) type = 'audio';
    return {
      id: crypto.randomUUID(),
      name: file.name,
      type,
      sizeBytes: encryptedBlob.size,
      encryptedBlobUrl,
      key: bytesToHex(new Uint8Array(exportedKey)),
      nonce: bytesToHex(iv),
      mimeType: file.type || 'application/octet-stream',
    };
  }

  revokeLocalAttachmentUrl(url: string) {
    if (url.startsWith('blob:')) URL.revokeObjectURL(url);
  }
}

export const e2eeCryptoEngine = new E2EECryptoEngineService();
