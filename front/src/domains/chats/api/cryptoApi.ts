import { httpClient } from '../../../shared/api/httpClient';
import { deviceCryptoManager } from '../crypto/DeviceCryptoManager';
import { backendTrustState, GAPAK_E2EE_PROTOCOL_VERSION, RecipientKeyBundle } from '../crypto/CryptoProtocol';
import { JsonWebKeyValidation } from '../crypto/JsonWebKeyValidation';
import { bytesToHex, canonicalJson, utf8 } from '../../../shared/security/hex';

export class E2EEBackendContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'E2EEBackendContractError';
  }
}

export class CurrentDeviceNotRegisteredError extends E2EEBackendContractError {
  constructor() {
    super('No server-registered device matches the local cryptographic identity.');
    this.name = 'CurrentDeviceNotRegisteredError';
  }
}

interface BackendTrustedDevice {
  id: string;
  userId: string;
  deviceName?: string | null;
  identityKeyPublic: string;
  signingKeyPublic?: string | null;
  fingerprint: string;
  trustStatus: string;
  createdAt: string;
  lastSeenAt?: string | null;
  revokedAt?: string | null;
}

interface CurrentRecipientDevice {
  id: string;
  identityKeyPublic: string;
  agreementKeyPublic?: string;
  signingKeyPublic?: string;
  trustStatus?: string;
  keyVersion?: number;
  signedPreKey?: { publicKey?: string; signature?: string | null; keyId?: string };
  oneTimePreKey?: { publicKey?: string; signature?: string | null; keyId?: string };
}

interface RecipientBundleResponse {
  userId: string;
  device?: CurrentRecipientDevice;
  devices?: CurrentRecipientDevice[];
  signedPreKey?: { publicKey?: string; signature?: string | null; keyId?: string };
  oneTimePreKey?: { publicKey?: string; signature?: string | null; keyId?: string };
}

let currentDeviceSetupPromise: Promise<{ deviceId: string }> | null = null;

/**
 * The backend calls an authenticated, non-revoked GAPAK device TRUSTED while
 * the UI historically calls the same state VERIFIED. Keep that translation at
 * the API boundary so the cryptographic policy never silently downgrades a
 * backend-issued trusted device to UNKNOWN.
 */
export const trustState = backendTrustState;

const parseJsonWebKey = (value: unknown, field: string): JsonWebKey => {
  if (typeof value !== 'string') throw new E2EEBackendContractError(`Backend did not provide ${field}.`);
  try {
    const parsed: unknown = JSON.parse(value);
    if (!JsonWebKeyValidation.isPublicKey(parsed)) throw new Error('not a public JWK');
    return parsed;
  } catch {
    throw new E2EEBackendContractError(`Backend returned an invalid ${field}.`);
  }
};

const parseOptionalJsonWebKey = (value: unknown, field: string): JsonWebKey | undefined => {
  if (value === undefined || value === null) return undefined;
  return parseJsonWebKey(value, field);
};

const findAgreementPublicKey = (device: CurrentRecipientDevice, response?: RecipientBundleResponse): JsonWebKey | undefined => {
  const direct = parseOptionalJsonWebKey(device.agreementKeyPublic, 'agreementKeyPublic');
  if (direct) return direct;
  const signed = parseOptionalJsonWebKey(device.signedPreKey?.publicKey ?? response?.signedPreKey?.publicKey, 'signedPreKey.publicKey');
  if (signed) return signed;
  return parseOptionalJsonWebKey(device.oneTimePreKey?.publicKey ?? response?.oneTimePreKey?.publicKey, 'oneTimePreKey.publicKey');
};

export const cryptoApi = {
  /**
   * Registers a browser device using only the backend-supported fields.
   * The server is authoritative for the device ID; the client never invents one.
   * Agreement public material is published through the approved pre-key endpoint after registration.
   */
  async registerCurrentDevice(deviceName = 'GAPAK Web Device') {
    const unbound = await deviceCryptoManager.createUnboundKeys();
    const identityKeyPublic = JSON.stringify(unbound.identityPublicJwk);
    const signingKeyPublic = JSON.stringify(unbound.signingPublicJwk);

    const response = await httpClient.post<BackendTrustedDevice>(
      '/chats/trusted-devices',
      { deviceName, identityKeyPublic, signingKeyPublic },
      // A server-side schema/transaction failure cannot be repaired by three
      // immediate browser retries. Keep one idempotent attempt and surface the
      // request ID; the user can retry after the backend recovers.
      { idempotencyKey: crypto.randomUUID(), retryCount: 0 },
    );

    if (!response?.id) throw new E2EEBackendContractError('Backend did not return the registered device ID.');
    const deviceId = response.id;
    const bound = await deviceCryptoManager.bindServerDeviceId(deviceId, unbound);

    const preKeyId = `${deviceId}:agreement:v1`;
    const preKeyData = canonicalJson({
      protocolVersion: GAPAK_E2EE_PROTOCOL_VERSION,
      deviceId,
      keyId: preKeyId,
      publicKey: bound.agreementPublicJwk,
      keyVersion: 1,
    });
    const signature = await deviceCryptoManager.sign(deviceId, utf8(preKeyData));

    await httpClient.post(
      `/chats/trusted-devices/${encodeURIComponent(deviceId)}/pre-keys`,
      {
        keyId: preKeyId,
        publicKey: JSON.stringify(bound.agreementPublicJwk),
        signature,
        oneTime: false,
      },
      { idempotencyKey: crypto.randomUUID() },
    );

    return {
      deviceId,
      identityKeyId: bound.identityKeyId,
      identityPublicKey: bound.identityPublicJwk,
      signingPublicKey: bound.signingPublicJwk,
      agreementPublicKey: bound.agreementPublicJwk,
      verificationStatus: trustState(response.trustStatus),
      keyVersion: 1,
    };
  },

  /**
   * Resolves the authenticated browser device by matching locally-held public keys
   * against server-issued device IDs. No local/generated device ID is accepted.
   */
  async getCurrentDevice(signal?: AbortSignal) {
    const serverDevices = await httpClient.get<BackendTrustedDevice[]>('/chats/trusted-devices', { signal });
    const localIds = await deviceKeyManagerIds();
    const matches: Array<{ server: BackendTrustedDevice; localId: string }> = [];

    const samePublicJwk = (a: JsonWebKey, b: JsonWebKey): boolean => {
      const keys = ['kty', 'crv', 'x', 'y', 'n', 'e'] as const;
      return keys.every((key) => (a as Record<string, unknown>)[key] === (b as Record<string, unknown>)[key]);
    };

    for (const localId of localIds) {
      const local = await deviceCryptoManager.getIdentity(localId);
      const match = serverDevices.find((device) => {
        if (!device.signingKeyPublic) return false;
        try {
          const identity = parseJsonWebKey(device.identityKeyPublic, 'identityKeyPublic');
          const signing = parseJsonWebKey(device.signingKeyPublic, 'signingKeyPublic');
          return samePublicJwk(identity, local.identityPublicJwk) && samePublicJwk(signing, local.signingPublicJwk);
        } catch {
          return false;
        }
      });
      if (match) matches.push({ server: match, localId });
    }

    if (matches.length !== 1) {
      if (matches.length === 0) throw new CurrentDeviceNotRegisteredError();
      throw new E2EEBackendContractError('Multiple server devices match the local cryptographic identity. Current device identity is ambiguous.');
    }

    const { server, localId } = matches[0];
    const local = await deviceCryptoManager.getIdentity(localId);
    return {
      deviceId: server.id,
      identityKeyId: `${server.id}:identity:v1`,
      identityPublicKey: parseJsonWebKey(server.identityKeyPublic, 'identityKeyPublic'),
      signingPublicKey: parseJsonWebKey(server.signingKeyPublic, 'signingKeyPublic'),
      verificationStatus: trustState(server.trustStatus),
      keyVersion: 1,
      localDeviceId: local.deviceId,
    };
  },

  /**
   * Resolves or registers this browser exactly once across auth hydration,
   * chat loading and a simultaneous first send.
   */
  ensureCurrentDevice() {
    if (!currentDeviceSetupPromise) {
      currentDeviceSetupPromise = cryptoApi.getCurrentDevice()
        .catch((error) => {
          if (!(error instanceof CurrentDeviceNotRegisteredError)) throw error;
          return cryptoApi.registerCurrentDevice('GAPAK Web Device');
        })
        .finally(() => { currentDeviceSetupPromise = null; });
    }
    return currentDeviceSetupPromise;
  },

  async recipientBundles(userIds: string[], signal?: AbortSignal): Promise<RecipientKeyBundle[]> {
    if (userIds.length === 0) return [];

    const responses = await Promise.all(
      userIds.map((userId) =>
        httpClient.get<RecipientBundleResponse>(`/chats/pre-key-bundles/${encodeURIComponent(userId)}`, { signal }),
      ),
    );

    return responses.flatMap((response) => {
      const devices = Array.isArray(response.devices) ? response.devices : response.device ? [response.device] : [];
      if (devices.length === 0) throw new E2EEBackendContractError(`Backend returned no recipient devices for user ${response.userId}.`);

      return devices.map((device) => {
        const agreementPublicKey = findAgreementPublicKey(device, devices.length === 1 ? response : undefined);
        if (!agreementPublicKey) throw new E2EEBackendContractError(`Recipient device ${device.id} has no usable agreement/pre-key public key.`);
        if (!device.signingKeyPublic) throw new E2EEBackendContractError(`Recipient device ${device.id} has no signing public key.`);
        const keyVersion = device.keyVersion ?? 1;
        if (keyVersion < 1) throw new E2EEBackendContractError(`Recipient device ${device.id} has no valid key version.`);

        return {
          deviceId: device.id,
          userId: response.userId,
          identityKeyId: `${device.id}:identity:v${keyVersion}`,
          identityPublicKey: parseJsonWebKey(device.identityKeyPublic, 'identityKeyPublic'),
          agreementPublicKey,
          signingPublicKey: parseJsonWebKey(device.signingKeyPublic, 'signingKeyPublic'),
          verificationStatus: trustState(device.trustStatus),
          keyVersion,
        } satisfies RecipientKeyBundle;
      });
    });
  },
};

async function deviceKeyManagerIds(): Promise<string[]> {
  const { deviceKeyStore } = await import('../../../shared/security/deviceKeyStore');
  return deviceKeyStore.listDeviceIds();
}
