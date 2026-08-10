export interface RecipientKeyBundle {
  deviceId: string;
  userId: string;
  identityKeyId: string;
  agreementPublicKey: JsonWebKey;
  signingPublicKey?: JsonWebKey;
  verificationStatus: 'verified' | 'unverified' | 'changed';
}

export interface DeviceRegistrationPayload {
  deviceId: string;
  deviceName: string;
  deviceType: 'web';
  identityKeyId: string;
  agreementPublicKey: JsonWebKey;
  signingPublicKey: JsonWebKey;
}

export interface EncryptedRecipientEnvelope {
  recipientDeviceId: string;
  ephemeralPublicKey: JsonWebKey;
  salt: string;
}

/**
 * This is a cryptographic transport foundation, not a claim of full Signal/Double-Ratchet E2EE.
 * Full E2EE requires the backend to authenticate device keys, distribute recipient bundles,
 * persist/replay-protect message counters, rotate/pre-key material, and enforce revocation.
 */
export interface BackendE2EEContract {
  protocolVersion: 'gapak-e2ee-v1';
  authenticatedDeviceKeys: true;
  recipientKeyBundles: true;
  serverCannotDecryptPayload: true;
  replayProtection: true;
  keyRotation: true;
  deviceRevocation: true;
}
