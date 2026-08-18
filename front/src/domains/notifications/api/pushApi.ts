import { httpClient } from '../../../shared/api/httpClient';
import type { PushDevice } from '../../../shared/api/backendContracts';

export interface RegisterPushDeviceRequest {
  deviceId: string;
  platform: 'web';
  provider: 'webpush';
  endpoint: string;
  publicKey: string;
  authKey: string;
  expiration?: string;
}

export const pushApi = {
  list: (signal?: AbortSignal) => httpClient.get<{ devices: PushDevice[] }>('/notifications/devices', { signal }),
  register: (input: RegisterPushDeviceRequest, idempotencyKey: string) => httpClient.post<PushDevice>('/notifications/devices', input, { idempotencyKey }),
  revoke: (id: string, idempotencyKey: string) => httpClient.delete<void>(`/notifications/devices/${encodeURIComponent(id)}`, { idempotencyKey }),
};
