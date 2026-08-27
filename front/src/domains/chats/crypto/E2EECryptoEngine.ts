/**
 * GAPAK E2EE protocol v1 cryptographic boundary.
 *
 * This is a custom protocol. It is NOT Signal Protocol and does NOT implement
 * Double Ratchet, X3DH, PQXDH or a comparable standardized ratcheting protocol.
 * The client therefore makes only the guarantees it can actually enforce locally
 * and fails closed where server-authenticated state is required.
 */
import { E2EEMessageEnvelope, ChatMessage, EncryptedAttachment, MessageContentType, UserProfile } from '../../../shared/types';
import { bytesToHex, canonicalJson, hexToBytes, sha256Hex, utf8, utf8Decode } from '../../../shared/security/hex';
import { deviceCryptoManager } from './DeviceCryptoManager';
import { cryptoApi } from '../api/cryptoApi';
import { canEncryptForTrustState, GAPAK_E2EE_PROTOCOL_VERSION, RecipientKeyBundle, TrustState } from './CryptoProtocol';
import { MessageProtocolValidation } from '../protocol/messageProtocol';
import type { SendMessageRequest, Message as BackendMessage } from '../../../shared/api/backendContracts';

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

// The backend intentionally returns only the key envelopes visible to the
// authenticated recipient. Signing the complete per-recipient envelope map
// would therefore produce different verification bytes for every viewer.
// Wrapped keys are independently authenticated with AES-GCM and message-bound
// AAD; the outer signature covers the immutable ciphertext and routing fields.
const canonicalAttachments = (attachments: EncryptedAttachment[] | undefined) => (attachments ?? []).map(attachment => ({
  mediaFileId: attachment.mediaFileId,
  name: attachment.name,
  type: attachment.type,
  sizeBytes: attachment.sizeBytes,
  mimeType: attachment.mimeType,
  ...(attachment.nonce ? { nonce: attachment.nonce } : {}),
  ...(attachment.durationSeconds !== undefined ? { durationSeconds: attachment.durationSeconds } : {}),
  ...(attachment.waveform ? { waveform: attachment.waveform } : {}),
}));

const canonicalEnvelopeData = (envelope: Pick<E2EEMessageEnvelope, 'id'|'chatId'|'senderId'|'senderDeviceId'|'senderKeyId'|'ciphertext'|'nonce'|'ratchetCounter'|'keyVersion'|'contentType'|'createdAt'|'expiresAt'|'replyToMessageId'|'attachments'>) => utf8(canonicalJson({
  id: envelope.id,
  chatId: envelope.chatId,
  senderId: envelope.senderId,
  senderDeviceId: envelope.senderDeviceId,
  senderKeyId: envelope.senderKeyId,
  ciphertext: envelope.ciphertext,
  nonce: envelope.nonce,
  ratchetCounter: envelope.ratchetCounter,
  keyVersion: envelope.keyVersion,
  contentType: envelope.contentType,
  createdAt: envelope.createdAt,
  ...(envelope.expiresAt ? { expiresAt: envelope.expiresAt } : {}),
  ...(envelope.replyToMessageId ? { replyToMessageId: envelope.replyToMessageId } : {}),
  ...(envelope.attachments?.length ? { attachments: canonicalAttachments(envelope.attachments) } : {}),
}));

const assertRecipientTrust = (bundles: RecipientKeyBundle[], recipientUserIds: string[]) => {
  const byUser = new Map<string, RecipientKeyBundle[]>();
  for (const bundle of bundles) {
    const current = byUser.get(bundle.userId) ?? [];
    current.push(bundle);
    byUser.set(bundle.userId, current);
  }
  for (const userId of recipientUserIds) {
    const devices = byUser.get(userId) ?? [];
    if (!devices.length) throw new Error(`No registered encryption devices are available for recipient ${userId}.`);
    if (devices.some((device) => !canEncryptForTrustState(device.verificationStatus))) {
      throw new Error(`Recipient ${userId} has a device in an untrusted state. Required state: VERIFIED.`);
    }
  }
  return bundles;
};


const backendEncryptionAlgorithm = 'GAPAK-E2EE-V1:AES-256-GCM+ECDH-P256+HKDF-SHA256+ECDSA-P256';

const keyEnvelopeToBackend = (raw: string) => {
  const parsed = JSON.parse(raw) as {
    recipientDeviceId: string;
    recipientUserId: string;
    identityKeyId: string;
    ephemeralPublicKey: JsonWebKey;
    salt: string;
    wrappedKey: string;
    wrappedIv: string;
    keyVersion: number;
  };
  return {
    recipientUserId: parsed.recipientUserId,
    recipientDeviceId: parsed.recipientDeviceId,
    keyId: parsed.identityKeyId,
    algorithm: backendEncryptionAlgorithm,
    encryptedKey: JSON.stringify({
      protocolVersion: GAPAK_E2EE_PROTOCOL_VERSION,
      recipientDeviceId: parsed.recipientDeviceId,
      recipientUserId: parsed.recipientUserId,
      identityKeyId: parsed.identityKeyId,
      ephemeralPublicKey: parsed.ephemeralPublicKey,
      salt: parsed.salt,
      wrappedKey: parsed.wrappedKey,
      keyVersion: parsed.keyVersion,
    }),
    nonce: parsed.wrappedIv,
    keyVersion: parsed.keyVersion,
  };
};

const backendMessageToEnvelope = (message: BackendMessage): E2EEMessageEnvelope => {
  if (!message.senderDeviceId || !message.ratchetCounter || !message.authenticationTag) {
    throw new DecryptionError('Backend message is missing authenticated GAPAK E2EE fields.');
  }
  const keyEnvelopes: Record<string, string> = {};
  for (const item of message.keyEnvelopes ?? []) {
    let encoded = item.encryptedKey;
    try {
      const parsed = JSON.parse(item.encryptedKey) as Record<string, unknown>;
      if (typeof parsed.ephemeralPublicKey !== 'object' || typeof parsed.wrappedKey !== 'string' || typeof parsed.salt !== 'string') {
        throw new Error('invalid encrypted key envelope');
      }
      encoded = JSON.stringify({
        recipientDeviceId: item.recipientDeviceId,
        recipientUserId: item.recipientUserId,
        identityKeyId: item.keyId,
        ephemeralPublicKey: parsed.ephemeralPublicKey,
        salt: parsed.salt,
        wrappedKey: parsed.wrappedKey,
        wrappedIv: item.nonce,
        keyVersion: item.keyVersion ?? 1,
      });
    } catch {
      throw new DecryptionError(`Malformed recipient key envelope for device ${item.recipientDeviceId}.`);
    }
    keyEnvelopes[item.recipientDeviceId] = encoded;
  }
  if (!Object.keys(keyEnvelopes).length) throw new DecryptionError('Backend message contains no recipient key envelopes.');

  const contentType = message.type as MessageContentType;
  const metadataMessageId = message.metadata?.messageId;
  const metadataCreatedAt = message.metadata?.createdAt;
  const metadataExpiresAt = message.metadata?.expiresAt;
  const metadataReplyToMessageId = message.metadata?.replyToMessageId;
  const cryptoMessageId = typeof metadataMessageId === 'string' && metadataMessageId.length > 0
    ? metadataMessageId
    : message.clientMessageId || message.id;
  const createdAt = typeof metadataCreatedAt === 'string' && !Number.isNaN(Date.parse(metadataCreatedAt))
    ? metadataCreatedAt
    : message.createdAt || message.sentAt;
  if (message.associatedData) {
    const expectedAssociatedData = bytesToHex(utf8(canonicalJson({
      protocolVersion: GAPAK_E2EE_PROTOCOL_VERSION,
      chatId: message.chatId,
      senderId: message.senderId,
      senderDeviceId: message.senderDeviceId,
      senderKeyId: message.senderKeyId,
      messageId: cryptoMessageId,
      ratchetCounter: message.ratchetCounter,
      keyVersion: Math.max(1, Number(message.metadata?.keyVersion ?? message.keyEnvelopes?.[0]?.keyVersion ?? 1)),
      contentType,
      createdAt,
    })));
    if (message.associatedData !== expectedAssociatedData) throw new DecryptionError('Backend associated data does not match the authenticated GAPAK E2EE envelope.');
  }
  return {
    protocolVersion: GAPAK_E2EE_PROTOCOL_VERSION,
    id: cryptoMessageId,
    clientMessageId: message.clientMessageId,
    chatId: message.chatId,
    senderId: message.senderId,
    senderDeviceId: message.senderDeviceId,
    senderKeyId: message.senderKeyId,
    content: null,
    ciphertext: message.ciphertext,
    nonce: message.nonce,
    keyEnvelopes,
    ratchetCounter: message.ratchetCounter,
    keyVersion: Math.max(1, Number(message.metadata?.keyVersion ?? message.keyEnvelopes?.[0]?.keyVersion ?? 1)),
    authenticationTag: message.authenticationTag,
    contentType,
    createdAt,
    // Only client-signed expiry metadata belongs to the crypto envelope. A
    // server-enforced room TTL is applied to UI/storage separately and must not
    // change the bytes covered by the sender signature.
    expiresAt: typeof metadataExpiresAt === 'string' ? metadataExpiresAt : undefined,
    replyToMessageId: typeof metadataReplyToMessageId === 'string'
      ? metadataReplyToMessageId
      : message.replyToMessageId ?? undefined,
    attachments: (message.attachments ?? []).map(attachment => ({
      id: attachment.id,
      mediaFileId: attachment.mediaFileId,
      name: attachment.fileName ?? 'attachment',
      type: attachment.kind.toLowerCase() as EncryptedAttachment['type'],
      sizeBytes: attachment.sizeBytes,
      mimeType: attachment.mimeType ?? 'application/octet-stream',
      nonce: typeof attachment.metadata?.nonce === 'string' ? attachment.metadata.nonce : undefined,
      durationSeconds: attachment.durationSeconds ?? undefined,
      waveform: Array.isArray(attachment.metadata?.waveform) ? attachment.metadata.waveform.filter((value): value is number => typeof value === 'number') : undefined,
    })),
  };
};

export class E2EECryptoEngineService {
  async ensureDevice(deviceId: string) { return deviceCryptoManager.getIdentity(deviceId); }

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
    if (!params.recipientUserIds.length) throw new Error('Encrypted messaging requires at least one recipient.');
    const senderIdentity = await this.ensureDevice(params.senderDeviceId);
    const serverDevice = await cryptoApi.getCurrentDevice();
    if (serverDevice.deviceId !== params.senderDeviceId) {
      throw new Error('Current encryption device does not match the authenticated server device.');
    }
    if (serverDevice.verificationStatus !== 'VERIFIED') {
      throw new Error(`Current device trust state ${serverDevice.verificationStatus} is not acceptable for encrypted sending. Required state: VERIFIED.`);
    }
    if (serverDevice.identityKeyId !== senderIdentity.identityKeyId || serverDevice.keyVersion !== 1) {
      throw new Error('Local encryption keys are stale relative to the authenticated server device. Key rotation is required before sending.');
    }
    const publicKeyMatches = (a: JsonWebKey, b: JsonWebKey) => a.kty === b.kty && a.crv === b.crv && a.x === b.x && a.y === b.y;
    if (!publicKeyMatches(serverDevice.identityPublicKey, senderIdentity.identityPublicJwk) || !publicKeyMatches(serverDevice.signingPublicKey, senderIdentity.signingPublicJwk)) {
      throw new Error('Authenticated server device keys do not match local device identity.');
    }
    const bundles = await cryptoApi.recipientBundles(params.recipientUserIds);
    const usable = assertRecipientTrust(bundles, params.recipientUserIds);
    const messageId = crypto.randomUUID();
    const sequence = await deviceCryptoManager.nextMessageCounter(params.senderDeviceId);
    const createdAt = new Date().toISOString();
    const keyVersion = 1;
    const messageKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    const messageKeyRaw = new Uint8Array(await crypto.subtle.exportKey('raw', messageKey));
    const messageIv = new Uint8Array(12);
    crypto.getRandomValues(messageIv);
    const aad = utf8(canonicalJson({ protocolVersion: GAPAK_E2EE_PROTOCOL_VERSION, chatId: params.chatId, senderId: params.senderId, senderDeviceId: params.senderDeviceId, senderKeyId: senderIdentity.identityKeyId, messageId, ratchetCounter: sequence, keyVersion, contentType: params.contentType, createdAt }));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: messageIv, additionalData: aad, tagLength: 128 }, messageKey, utf8(params.plaintext));

    const ephemeral = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const ephemeralPublicKey = await crypto.subtle.exportKey('jwk', ephemeral.publicKey);
    const keyEnvelopes: Record<string, string> = {};
    for (const bundle of usable) {
      const salt = new Uint8Array(32);
      crypto.getRandomValues(salt);
      const info = utf8(`${GAPAK_E2EE_PROTOCOL_VERSION}|wrap-key|${params.chatId}|${messageId}|${bundle.deviceId}|v${bundle.keyVersion}`);
      const wrappingKey = await deriveAesKey(ephemeral.privateKey, bundle.agreementPublicKey, salt, info);
      const wrapped = await encryptWithKey(wrappingKey, messageKeyRaw, utf8(canonicalJson({ chatId: params.chatId, messageId, recipientDeviceId: bundle.deviceId, recipientIdentityKeyId: bundle.identityKeyId })));
      keyEnvelopes[bundle.deviceId] = JSON.stringify({ recipientDeviceId: bundle.deviceId, recipientUserId: bundle.userId, ephemeralPublicKey, salt: bytesToHex(salt), wrappedKey: wrapped.ciphertext, wrappedIv: wrapped.iv, identityKeyId: bundle.identityKeyId, keyVersion: bundle.keyVersion });
    }

    const envelopeBase: E2EEMessageEnvelope = {
      protocolVersion: GAPAK_E2EE_PROTOCOL_VERSION,
      id: messageId,
      chatId: params.chatId,
      senderId: params.senderId,
      senderDeviceId: params.senderDeviceId,
      senderKeyId: senderIdentity.identityKeyId,
      content: null,
      ciphertext: bytesToHex(new Uint8Array(ciphertext)),
      nonce: bytesToHex(messageIv),
      keyEnvelopes,
      ratchetCounter: sequence,
      keyVersion,
      authenticationTag: '',
      attachments: params.attachments,
      contentType: params.contentType,
      createdAt,
      expiresAt: params.expiresAt,
      replyToMessageId: params.replyToMessageId,
    };
    const signature = await deviceCryptoManager.sign(params.senderDeviceId, canonicalEnvelopeData(envelopeBase));
    const envelope = { ...envelopeBase, authenticationTag: signature };
    const validation = MessageProtocolValidation.validateWireEnvelope(envelope);
    if (!validation.isValid) throw new Error(validation.error ?? 'Invalid encrypted message envelope');
    return envelope;
  }

  toBackendSendMessageRequest(envelope: E2EEMessageEnvelope): SendMessageRequest {
    const associatedData = utf8(canonicalJson({
      protocolVersion: envelope.protocolVersion,
      chatId: envelope.chatId,
      senderId: envelope.senderId,
      senderDeviceId: envelope.senderDeviceId,
      senderKeyId: envelope.senderKeyId,
      messageId: envelope.id,
      ratchetCounter: envelope.ratchetCounter,
      keyVersion: envelope.keyVersion,
      contentType: envelope.contentType,
      createdAt: envelope.createdAt,
    }));

    const request: SendMessageRequest = {
      clientMessageId: envelope.clientMessageId ?? envelope.id,
      senderDeviceId: envelope.senderDeviceId,
      type: envelope.contentType,
      ciphertext: envelope.ciphertext,
      nonce: envelope.nonce,
      senderKeyId: envelope.senderKeyId,
      encryptionProtocol: 'TRUSTED_CHAT',
      encryptionAlgorithm: backendEncryptionAlgorithm,
      associatedData: bytesToHex(associatedData),
      ratchetCounter: envelope.ratchetCounter,
      authenticationTag: envelope.authenticationTag,
      metadata: {
        gapakProtocolVersion: envelope.protocolVersion,
        messageId: envelope.id,
        keyVersion: envelope.keyVersion,
        createdAt: envelope.createdAt,
        ...(envelope.expiresAt ? { expiresAt: envelope.expiresAt } : {}),
        ...(envelope.replyToMessageId ? { replyToMessageId: envelope.replyToMessageId } : {}),
      },
      replyToMessageId: envelope.replyToMessageId,
      keyEnvelopes: Object.values(envelope.keyEnvelopes).map(keyEnvelopeToBackend),
    };

    if (envelope.attachments?.length) request.attachments = envelope.attachments.map(attachment => ({
      mediaFileId: attachment.mediaFileId,
      kind: attachment.type.toUpperCase() as NonNullable<SendMessageRequest['attachments']>[number]['kind'],
      fileName: attachment.name,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      metadata: attachment.nonce ? { nonce: attachment.nonce } : undefined,
      durationSeconds: attachment.durationSeconds,
      ...(attachment.waveform ? { metadata: { ...(attachment.nonce ? { nonce: attachment.nonce } : {}), waveform: attachment.waveform } } : {}),
    }));
    return request;
  }

  toBackendEditMessageRequest(envelope: E2EEMessageEnvelope) {
    const request = this.toBackendSendMessageRequest(envelope);
    return {
      senderDeviceId: request.senderDeviceId,
      senderKeyId: request.senderKeyId,
      ciphertext: request.ciphertext,
      nonce: request.nonce,
      authenticationTag: request.authenticationTag,
      metadata: request.metadata,
      encryptionProtocol: request.encryptionProtocol,
      encryptionAlgorithm: request.encryptionAlgorithm,
      associatedData: request.associatedData,
      ratchetCounter: request.ratchetCounter,
      keyEnvelopes: request.keyEnvelopes,
    };
  }

  fromBackendMessage(message: BackendMessage): E2EEMessageEnvelope {
    return backendMessageToEnvelope(message);
  }

  async decryptMessage(params: {
    envelope: E2EEMessageEnvelope;
    senderProfile: UserProfile;
    targetDeviceId: string;
    senderSigningPublicJwk: JsonWebKey;
    senderTrustState: TrustState;
  }): Promise<ChatMessage> {
    const { envelope, senderProfile, targetDeviceId, senderSigningPublicJwk, senderTrustState } = params;
    if (!canEncryptForTrustState(senderTrustState)) throw new DecryptionError(`Sender device trust state ${senderTrustState} is not acceptable for decryption.`);
    const validation = MessageProtocolValidation.validateWireEnvelope(envelope);
    if (!validation.isValid) throw new DecryptionError(validation.error ?? 'Invalid encrypted message envelope');
    const signingKey = await crypto.subtle.importKey('jwk', senderSigningPublicJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const verified = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, signingKey, hexToBytes(envelope.authenticationTag), canonicalEnvelopeData(envelope));
    if (!verified) throw new DecryptionError('Message signature verification failed');
    const recipientEnvelopeRaw = envelope.keyEnvelopes[targetDeviceId];
    if (!recipientEnvelopeRaw) throw new DecryptionError('No encrypted recipient envelope exists for this device');
    const recipientEnvelope = JSON.parse(recipientEnvelopeRaw) as { ephemeralPublicKey: JsonWebKey; salt: string; wrappedKey: string; wrappedIv: string; identityKeyId: string; keyVersion: number };
    if (recipientEnvelope.keyVersion !== envelope.keyVersion) throw new DecryptionError('Recipient key version does not match the message key version');
    const info = utf8(`${GAPAK_E2EE_PROTOCOL_VERSION}|wrap-key|${envelope.chatId}|${envelope.id}|${targetDeviceId}|v${recipientEnvelope.keyVersion}`);
    const wrappingKey = await deviceCryptoManager.decryptWithAgreement(targetDeviceId, recipientEnvelope.ephemeralPublicKey, hexToBytes(recipientEnvelope.salt), info);
    const wrappedKeyPlaintext = await decryptWithKey(wrappingKey, recipientEnvelope.wrappedKey, recipientEnvelope.wrappedIv, utf8(canonicalJson({ chatId: envelope.chatId, messageId: envelope.id, recipientDeviceId: targetDeviceId, recipientIdentityKeyId: recipientEnvelope.identityKeyId })));
    const messageKey = await crypto.subtle.importKey('raw', wrappedKeyPlaintext, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    const aad = utf8(canonicalJson({ protocolVersion: GAPAK_E2EE_PROTOCOL_VERSION, chatId: envelope.chatId, senderId: envelope.senderId, senderDeviceId: envelope.senderDeviceId, senderKeyId: envelope.senderKeyId, messageId: envelope.id, ratchetCounter: envelope.ratchetCounter, keyVersion: envelope.keyVersion, contentType: envelope.contentType, createdAt: envelope.createdAt }));
    const plaintext = await decryptWithKey(messageKey, envelope.ciphertext, envelope.nonce, aad);
    // Persisted history is expected to be decrypted repeatedly after cache
    // invalidation, reload, reactions and receipt updates. Transport replay is
    // rejected by server IDs/sequences and RealtimeEventRouter; treating a
    // second read of the same durable message as an attack corrupts history.
    const voiceAttachment = envelope.attachments?.find(attachment => attachment.type === 'voice');
    return {
      id: envelope.id,
      chatId: envelope.chatId,
      sender: senderProfile,
      senderKeyId: envelope.senderKeyId,
      content: utf8Decode(plaintext),
      contentType: envelope.contentType,
      state: 'delivered',
      createdAt: envelope.createdAt,
      expiresAt: envelope.expiresAt,
      replyToMessageId: envelope.replyToMessageId,
      reactions: [],
      attachments: envelope.attachments,
      voice: voiceAttachment ? { durationSeconds: voiceAttachment.durationSeconds ?? 0, waveform: voiceAttachment.waveform ?? [] } : undefined,
    };
  }

}

export const e2eeCryptoEngine = new E2EECryptoEngineService();
