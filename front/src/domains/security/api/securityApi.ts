import { httpClient } from '../../../shared/api/httpClient';
import type {
  AuditEvent,
  BackendProfile,
  BackendSession,
  DeviceAlert,
  PanicModeRequest,
  PanicModeResponse,
  SecurityFlag,
  TrustedDevice,
} from '../../../shared/api/backendContracts';

export interface SecurityStateResponse {
  sessions: BackendSession[];
  auditEvents: AuditEvent[];
  alerts: DeviceAlert[];
  flags: SecurityFlag[];
  twoFactor: { enabled: boolean };
  profile: BackendProfile;
}

export const securityApi = {
  state: async (signal?: AbortSignal): Promise<SecurityStateResponse> => {
    const [sessions, auditEvents, alerts, flags, profile] = await Promise.all([
      httpClient.get<BackendSession[]>('/sessions', { signal }),
      httpClient.get<AuditEvent[]>('/security/audit-events', { signal }),
      httpClient.get<DeviceAlert[]>('/security/alerts', { signal }),
      httpClient.get<SecurityFlag[]>('/security/flags', { signal }),
      httpClient.get<BackendProfile>('/users/me', { signal }),
    ]);
    return { sessions, auditEvents, alerts, flags, twoFactor: { enabled: profile.twoFactorEnabled }, profile };
  },
  sessions: (signal?: AbortSignal) => httpClient.get<BackendSession[]>('/sessions', { signal }),
  revokeSession: (sessionId: string, signal?: AbortSignal) => httpClient.delete<void>(`/sessions/${encodeURIComponent(sessionId)}`, { signal }),
  revokeOtherSessions: (signal?: AbortSignal) => httpClient.delete<void>('/sessions/others', { signal }),
  devices: (signal?: AbortSignal) => httpClient.get<TrustedDevice[]>('/chats/trusted-devices', { signal }),
  revokeDevice: (deviceId: string, signal?: AbortSignal) => httpClient.delete<void>(`/chats/trusted-devices/${encodeURIComponent(deviceId)}`, { signal }),
  twoFactorSetup: (signal?: AbortSignal) => httpClient.post<{ secret: string; otpAuthUrl: string }>('/auth/2fa/setup', undefined, { signal }),
  twoFactorVerify: (code: string, signal?: AbortSignal) => httpClient.post<{ accepted: boolean }>('/auth/2fa/verify', { code }, { signal }),
  twoFactorDisable: (signal?: AbortSignal) => httpClient.post<{ accepted: boolean }>('/auth/2fa/disable', undefined, { signal }),
  panic: (input: PanicModeRequest, signal?: AbortSignal) => httpClient.post<PanicModeResponse>('/security/panic-mode', input, { signal }),
};
