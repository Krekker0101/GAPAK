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
  state: async (signal?: AbortSignal) => assertSecurityState<SecurityStateResponse>(await httpClient.get('/api/security/state', { signal })),
  sessions: (signal?: AbortSignal) => httpClient.get<UserSession[]>('/api/security/sessions', { signal }),
  revokeSession: (sessionId: string) => httpClient.post<void>(`/api/security/sessions/${encodeURIComponent(sessionId)}/revoke`, undefined, { idempotencyKey: crypto.randomUUID() }),
  revokeOtherSessions: () => httpClient.post<void>('/api/security/sessions/revoke-others', undefined, { idempotencyKey: crypto.randomUUID() }),
  devices: (signal?: AbortSignal) => httpClient.get<TrustedDevice[]>('/api/security/devices', { signal }),
  revokeDevice: (deviceId: string) => httpClient.post<void>(`/api/security/devices/${encodeURIComponent(deviceId)}/revoke`, undefined, { idempotencyKey: crypto.randomUUID() }),
  verifyDevice: (deviceId: string) => httpClient.post<void>(`/api/security/devices/${encodeURIComponent(deviceId)}/verify`, undefined, { idempotencyKey: crypto.randomUUID() }),
  twoFactorSetup: () => httpClient.post<TwoFactorSetupData>('/api/security/2fa/totp/setup', undefined, { idempotencyKey: crypto.randomUUID() }),
  twoFactorVerify: (code: string, setupId?: string) => httpClient.post<TwoFactorState>('/api/security/2fa/totp/verify', { code, ...(setupId ? { setupId } : {}) }, { idempotencyKey: crypto.randomUUID() }),
  twoFactorDisable: () => httpClient.post<TwoFactorState>('/api/security/2fa/disable', undefined, { idempotencyKey: crypto.randomUUID() }),
  markAlertRead: (alertId: string) => httpClient.post<void>(`/api/security/alerts/${encodeURIComponent(alertId)}/read`, undefined, { idempotencyKey: crypto.randomUUID() }),
  dismissAlert: (alertId: string) => httpClient.post<void>(`/api/security/alerts/${encodeURIComponent(alertId)}/dismiss`, undefined, { idempotencyKey: crypto.randomUUID() }),
  setFlag: (key: keyof Pick<SecurityFlags, 'sessionStrictIpChecking'|'unrecognizedDeviceAlerts'|'enforce2FaForSensitiveActions'>, enabled: boolean) => httpClient.patch<SecurityFlags>('/api/security/preferences', { key, enabled }),
  panic: () => httpClient.post<PanicExecutionResult>('/api/security/panic', undefined, { idempotencyKey: crypto.randomUUID() }),
  clearPanic: () => httpClient.post<void>('/api/security/panic/clear', undefined, { idempotencyKey: crypto.randomUUID() }),
};
