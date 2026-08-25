export type TrustState = 'VERIFIED' | 'UNVERIFIED' | 'CHANGED' | 'REVOKED' | 'UNKNOWN';

export const backendTrustState = (value: unknown): TrustState => {
  if (value === 'TRUSTED') return 'VERIFIED';
  return value === 'VERIFIED' || value === 'UNVERIFIED' || value === 'CHANGED' || value === 'REVOKED' || value === 'UNKNOWN'
    ? value
    : 'UNKNOWN';
};

/**
 * GAPAK E2EE protocol v1.
 *
 * This is a custom protocol and is NOT Signal Protocol / Double Ratchet.
 * The client deliberately fails closed unless the backend supplies authenticated,
 * non-revoked device bundles and enforces the same protocol invariants server-side.
 */
export const GAPAK_E2EE_PROTOCOL_VERSION = 'gapak-e2ee-v1' as const;

export interface RecipientKeyBundle {
  deviceId: string;
  userId: string;
  identityKeyId: string;
  identityPublicKey: JsonWebKey;
  agreementPublicKey: JsonWebKey;
  signingPublicKey: JsonWebKey;
  verificationStatus: TrustState;
  keyVersion: number;
}

export interface DeviceRegistrationPayload {
  deviceId: string;
  deviceName: string;
  deviceType: 'web';
  identityKeyId: string;
  identityPublicKey: JsonWebKey;
  agreementPublicKey: JsonWebKey;
  signingPublicKey: JsonWebKey;
  keyVersion: number;
}

export interface EncryptedRecipientEnvelope {
  recipientDeviceId: string;
  recipientUserId: string;
  identityKeyId: string;
  ephemeralPublicKey: JsonWebKey;
  salt: string;
  wrappedKey: string;
  wrappedIv: string;
}

export interface BackendE2EEContract {
  protocolVersion: typeof GAPAK_E2EE_PROTOCOL_VERSION;
  authenticatedDeviceKeys: true;
  recipientKeyBundles: true;
  serverCannotDecryptPayload: true;
  replayProtection: true;
  keyRotation: true;
  deviceRevocation: true;
  perDeviceKeyBundles: true;
  messageAcknowledgements: true;
}

/**
 * Release policy: encrypted messages are sent only to VERIFIED recipient devices.
 * UNVERIFIED, CHANGED, REVOKED and UNKNOWN are all fail-closed states.
 */
export const canEncryptForTrustState = (state: TrustState): boolean => state === 'VERIFIED';
