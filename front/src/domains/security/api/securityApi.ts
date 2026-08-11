import { httpClient } from '../../../shared/api/httpClient';
import { assertSecurityState } from '../../../shared/api/schemas';
import { AuditEvent, SecurityAlert, SecurityFlags, TwoFactorSetupData, TwoFactorState, UserSession, PanicExecutionResult } from '../../../shared/types/security';
import { TrustedDevice } from '../../../shared/types/chat';

export interface SecurityStateResponse {
  sessions: UserSession[];
  twoFactor: TwoFactorState;
  auditEvents: AuditEvent[];
  alerts: SecurityAlert[];
  flags: SecurityFlags;
}

export const securityApi = {
  state: async (signal?: AbortSignal) => {
    const [sessions, auditEvents, alerts, flags] = await Promise.all([
      httpClient.get<UserSession[]>('/api/sessions/', { signal }),
      httpClient.get<AuditEvent[]>('/api/security/audit-events', { signal }),
      httpClient.get<SecurityAlert[]>('/api/security/alerts', { signal }),
      httpClient.get<SecurityFlags>('/api/security/flags', { signal }),
    ]);
    return assertSecurityState<SecurityStateResponse>({ sessions, auditEvents, alerts, flags, twoFactor: { enabled: false } as TwoFactorState });
  },
  sessions: (signal?: AbortSignal) => httpClient.get<UserSession[]>('/api/sessions/', { signal }),
  revokeSession: (sessionId: string) => httpClient.delete<void>(`/api/sessions/${encodeURIComponent(sessionId)}`, { idempotencyKey: crypto.randomUUID() }),
  revokeOtherSessions: () => httpClient.delete<void>('/api/sessions/others', { idempotencyKey: crypto.randomUUID() }),
  devices: (signal?: AbortSignal) => httpClient.get<TrustedDevice[]>('/api/chats/trusted-devices', { signal }),
  revokeDevice: (deviceId: string) => httpClient.delete<void>(`/api/chats/trusted-devices/${encodeURIComponent(deviceId)}`),
  verifyDevice: async (_deviceId: string) => undefined,
  twoFactorSetup: async () => {
    const response = await httpClient.post<{ secret: string; otpAuthUrl: string }>('/api/auth/2fa/setup', undefined, { idempotencyKey: crypto.randomUUID() });
    return { setupId: undefined, qrCodeUrl: response.otpAuthUrl, secretKey: response.secret, manualEntryCode: response.secret };
  },
  twoFactorVerify: async (code: string, _setupId?: string) => {
    await httpClient.post('/api/auth/2fa/verify', { code }, { idempotencyKey: crypto.randomUUID() });
    return { enabled: true, method: 'totp' as const, backupCodesRemaining: 0 };
  },
  twoFactorDisable: async () => { await httpClient.post('/api/auth/2fa/disable', undefined, { idempotencyKey: crypto.randomUUID() }); return { enabled: false, backupCodesRemaining: 0 }; },
  markAlertRead: async (_alertId: string) => undefined,
  dismissAlert: async (_alertId: string) => undefined,
  setFlag: async (key, enabled) => ({ [key]: enabled } as SecurityFlags),
  panic: () => httpClient.post<PanicExecutionResult>('/api/security/panic-mode', { preserveCurrentSession: true, reason: 'User requested panic mode' }, { idempotencyKey: crypto.randomUUID() }),
  clearPanic: async () => undefined,
};
