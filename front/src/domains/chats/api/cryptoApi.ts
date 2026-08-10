import { httpClient } from '../../../shared/api/httpClient';
import { DeviceRegistrationPayload, RecipientKeyBundle } from '../crypto/CryptoProtocol';

export const cryptoApi = {
  async registerCurrentDevice(data: DeviceRegistrationPayload) {
    return httpClient.post<{ deviceId: string; identityKeyId: string; registeredAt: string }>('/api/security/devices/crypto/register', data);
  },
  async getCurrentDevice(signal?: AbortSignal) {
    return httpClient.get<{ deviceId: string; identityKeyId: string; agreementPublicKey: JsonWebKey; signingPublicKey: JsonWebKey; verificationStatus: string }>('/api/security/devices/current/crypto', { signal });
  },
  async recipientBundles(userIds: string[], signal?: AbortSignal): Promise<RecipientKeyBundle[]> {
    if (userIds.length === 0) return [];
    return httpClient.post<RecipientKeyBundle[]>('/api/security/devices/recipient-key-bundles', { userIds }, { signal });
  },
  async rotateCurrentDevice(data: { deviceId: string; identityKeyId: string; agreementPublicKey: JsonWebKey; signingPublicKey: JsonWebKey }) {
    return httpClient.post<{ deviceId: string; identityKeyId: string; rotatedAt: string }>('/api/security/devices/current/crypto/rotate', data, { idempotencyKey: crypto.randomUUID() });
  },
};
