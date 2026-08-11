import { httpClient } from '../../../shared/api/httpClient';
import { DeviceRegistrationPayload, RecipientKeyBundle } from '../crypto/CryptoProtocol';

export const cryptoApi = {
  async registerCurrentDevice(data: DeviceRegistrationPayload) {
    const response = await httpClient.post<{ device: { id: string; createdAt: string } }>('/api/chats/trusted-devices', { deviceName: data.deviceName, identityKeyPublic: JSON.stringify(data.agreementPublicKey), signingKeyPublic: JSON.stringify(data.signingPublicKey) });
    return { deviceId: response.device.id, identityKeyId: data.identityKeyId, registeredAt: response.device.createdAt };
  },
  async getCurrentDevice(signal?: AbortSignal) {
    const devices = await httpClient.get<Array<{ id: string; identityKeyPublic: string; signingKeyPublic?: string; trustStatus: string }>>('/api/chats/trusted-devices', { signal });
    const device = devices[0];
    if (!device) throw new Error('No registered trusted device');
    return { deviceId: device.id, identityKeyId: `${device.id}:identity`, agreementPublicKey: JSON.parse(device.identityKeyPublic) as JsonWebKey, signingPublicKey: device.signingKeyPublic ? JSON.parse(device.signingKeyPublic) as JsonWebKey : ({} as JsonWebKey), verificationStatus: device.trustStatus };
  },
  async recipientBundles(userIds: string[], signal?: AbortSignal): Promise<RecipientKeyBundle[]> {
    if (userIds.length === 0) return [];
    const bundles = await Promise.all(userIds.map(async (userId) => { const bundle = await httpClient.get<any>(`/api/chats/pre-key-bundles/${encodeURIComponent(userId)}`, { signal }); return { deviceId: bundle.device.id, userId: bundle.userId, identityKeyId: bundle.device.id + ':identity', agreementPublicKey: JSON.parse(bundle.device.identityKeyPublic), signingPublicKey: bundle.device.signingKeyPublic ? JSON.parse(bundle.device.signingKeyPublic) : undefined, verificationStatus: bundle.device.trustStatus === 'VERIFIED' ? 'verified' : bundle.device.trustStatus === 'CHANGED' ? 'changed' : 'unverified' } as RecipientKeyBundle; }));
    return bundles;
  },
  async rotateCurrentDevice(_data: { deviceId: string; identityKeyId: string; agreementPublicKey: JsonWebKey; signingPublicKey: JsonWebKey }) { throw new Error('Device key rotation is not exposed by the current backend contract.'); },
};
