/** GAPAK encrypted-message wire validation. */
import { E2EEMessageEnvelope } from '../../../shared/types';

export class MessageProtocolValidation {
  static validateWireEnvelope(envelope: unknown): { isValid: boolean; error?: string } {
    if (!envelope || typeof envelope !== 'object') return { isValid: false, error: 'Envelope must be an object' };
    const value = envelope as Partial<E2EEMessageEnvelope>;
    if (value.content !== null) return { isValid: false, error: 'Plaintext content is forbidden on the wire' };
    if (value.protocolVersion && value.protocolVersion !== 'gapak-e2ee-v1') return { isValid: false, error: 'Unsupported E2EE protocol version' };
    if (!value.ciphertext || !/^(?:[0-9a-f]{2})+$/i.test(value.ciphertext)) return { isValid: false, error: 'Ciphertext must be hex-encoded bytes' };
    if (!value.nonce || !/^[0-9a-f]{24}$/i.test(value.nonce)) return { isValid: false, error: 'AES-GCM nonce must be 12 bytes' };
    if (!value.senderKeyId || typeof value.senderKeyId !== 'string') return { isValid: false, error: 'Missing sender key identifier' };
    if (!value.keyEnvelopes || typeof value.keyEnvelopes !== 'object' || Object.keys(value.keyEnvelopes).length === 0) return { isValid: false, error: 'Missing recipient key envelopes' };
    if (typeof value.ratchetCounter !== 'number' || value.ratchetCounter < 0) return { isValid: false, error: 'Invalid message sequence counter' };
    if (!value.authenticationTag || !/^(?:[0-9a-f]{2})+$/i.test(value.authenticationTag)) return { isValid: false, error: 'Missing or invalid message signature' };
    for (const [deviceId, raw] of Object.entries(value.keyEnvelopes)) {
      if (typeof raw !== 'string') return { isValid: false, error: `Invalid key envelope for ${deviceId}` };
      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        if (typeof parsed.wrappedKey !== 'string' || typeof parsed.wrappedIv !== 'string' || !parsed.ephemeralPublicKey || typeof parsed.salt !== 'string') {
          return { isValid: false, error: `Incomplete key envelope for ${deviceId}` };
        }
      } catch { return { isValid: false, error: `Malformed key envelope for ${deviceId}` }; }
    }
    return { isValid: true };
  }
}
