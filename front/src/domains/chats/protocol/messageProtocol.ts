import { E2EEMessageEnvelope } from '../../../shared/types';
import { GAPAK_E2EE_PROTOCOL_VERSION } from '../crypto/CryptoProtocol';

/** Strict wire validator for GAPAK E2EE protocol v1. */
export class MessageProtocolValidation {
  static validateWireEnvelope(envelope: unknown): { isValid: boolean; error?: string } {
    if (!envelope || typeof envelope !== 'object') return { isValid: false, error: 'Envelope must be an object' };
    const value = envelope as Partial<E2EEMessageEnvelope>;
    if (value.protocolVersion !== GAPAK_E2EE_PROTOCOL_VERSION) return { isValid: false, error: 'Unsupported or missing GAPAK E2EE protocol version' };
    if (value.content !== null) return { isValid: false, error: 'Plaintext content is forbidden on the wire' };
    if (!value.id || typeof value.id !== 'string') return { isValid: false, error: 'Missing message identifier' };
    if (!value.chatId || typeof value.chatId !== 'string') return { isValid: false, error: 'Missing chat identifier' };
    if (!value.senderId || typeof value.senderId !== 'string') return { isValid: false, error: 'Missing sender identifier' };
    if (!value.senderDeviceId || typeof value.senderDeviceId !== 'string') return { isValid: false, error: 'Missing sender device identifier' };
    if (!value.senderKeyId || typeof value.senderKeyId !== 'string') return { isValid: false, error: 'Missing sender key identifier' };
    if (!Number.isSafeInteger(value.ratchetCounter) || (value.ratchetCounter ?? 0) < 1) return { isValid: false, error: 'Invalid sender-device message sequence' };
    if (!Number.isSafeInteger(value.keyVersion) || (value.keyVersion ?? 0) < 1) return { isValid: false, error: 'Invalid key version' };
    if (!value.ciphertext || !/^(?:[0-9a-f]{2})+$/i.test(value.ciphertext)) return { isValid: false, error: 'Ciphertext must be hex-encoded bytes' };
    if (!value.nonce || !/^[0-9a-f]{24}$/i.test(value.nonce)) return { isValid: false, error: 'AES-GCM nonce must be 12 bytes' };
    if (!value.keyEnvelopes || typeof value.keyEnvelopes !== 'object' || Object.keys(value.keyEnvelopes).length === 0) return { isValid: false, error: 'Missing recipient key envelopes' };
    if (!value.authenticationTag || !/^(?:[0-9a-f]{2})+$/i.test(value.authenticationTag)) return { isValid: false, error: 'Missing or invalid message signature' };
    if (!value.createdAt || Number.isNaN(Date.parse(value.createdAt))) return { isValid: false, error: 'Invalid creation timestamp' };
    for (const [deviceId, raw] of Object.entries(value.keyEnvelopes)) {
      if (typeof raw !== 'string') return { isValid: false, error: `Invalid key envelope for ${deviceId}` };
      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        if (parsed.recipientDeviceId !== deviceId || typeof parsed.recipientUserId !== 'string' || typeof parsed.wrappedKey !== 'string' || typeof parsed.wrappedIv !== 'string' || !parsed.ephemeralPublicKey || typeof parsed.salt !== 'string' || typeof parsed.identityKeyId !== 'string' || !Number.isSafeInteger(parsed.keyVersion)) {
          return { isValid: false, error: `Incomplete key envelope for ${deviceId}` };
        }
      } catch {
        return { isValid: false, error: `Malformed key envelope for ${deviceId}` };
      }
    }
    return { isValid: true };
  }
}
