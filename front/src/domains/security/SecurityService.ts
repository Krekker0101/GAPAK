/** Server-backed security domain service. No fixture state is kept here. */
import { AuditEvent, SecurityAlert, SecurityFlags, TwoFactorSetupData, TwoFactorState, UserSession, PanicExecutionResult } from '../../shared/types/security';
import { TrustedDevice } from '../../shared/types/chat';
import { securityApi, SecurityStateResponse } from './api/securityApi';

export interface SecurityState extends SecurityStateResponse { devices: TrustedDevice[]; }
type Listener = (state: SecurityState) => void;

const EMPTY_STATE: SecurityState = {
  sessions: [],
  twoFactor: { enabled: false, backupCodesRemaining: 0 },
  auditEvents: [],
  alerts: [],
  flags: { panicModeActive: false, sessionStrictIpChecking: false, unrecognizedDeviceAlerts: false, enforce2FaForSensitiveActions: true },
  devices: [],
};

class SecurityServiceClass {
  private state: SecurityState = EMPTY_STATE;
  private listeners = new Set<Listener>();
  private loadPromise: Promise<SecurityState> | null = null;

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  getState(): SecurityState { return this.state; }

  private publish(next: Partial<SecurityState>) {
    this.state = { ...this.state, ...next };
    this.listeners.forEach((listener) => listener(this.state));
  }

  async load(signal?: AbortSignal): Promise<SecurityState> {
    if (this.loadPromise) return this.loadPromise;
    this.loadPromise = Promise.all([securityApi.state(signal), securityApi.devices(signal)])
      .then(([security, devices]) => { this.state = { ...security, devices }; this.listeners.forEach((l) => l(this.state)); return this.state; })
      .finally(() => { this.loadPromise = null; });
    return this.loadPromise;
  }

  async refresh(): Promise<SecurityState> { return this.load(); }
  async getSessions(): Promise<UserSession[]> { const sessions = await securityApi.sessions(); this.publish({ sessions }); return sessions; }
  async revokeSession(sessionId: string): Promise<void> { await securityApi.revokeSession(sessionId); await this.refresh(); }
  async revokeOtherSessions(): Promise<void> { await securityApi.revokeOtherSessions(); await this.refresh(); }
  async getDevices(): Promise<TrustedDevice[]> { const devices = await securityApi.devices(); this.publish({ devices }); return devices; }
  async revokeDevice(deviceId: string): Promise<void> { await securityApi.revokeDevice(deviceId); await this.getDevices(); }
  async verifyDevice(deviceId: string): Promise<void> { await securityApi.verifyDevice(deviceId); await this.getDevices(); }
  async get2FaSetupData(): Promise<TwoFactorSetupData> { return securityApi.twoFactorSetup(); }
  async verifyAndEnable2Fa(code: string, setupId?: string): Promise<{ success: boolean; message: string }> {
    try { const twoFactor = await securityApi.twoFactorVerify(code, setupId); this.publish({ twoFactor }); return { success: true, message: 'Two-Factor Authentication successfully enabled.' }; }
    catch (error) { return { success: false, message: error instanceof Error ? error.message : 'Verification failed' }; }
  }
  async disable2Fa(): Promise<void> { const twoFactor = await securityApi.twoFactorDisable(); this.publish({ twoFactor }); }
  async markAlertRead(alertId: string): Promise<void> { await securityApi.markAlertRead(alertId); this.publish({ alerts: this.state.alerts.map((a) => a.id === alertId ? { ...a, isRead: true } : a) }); }
  async dismissAlert(alertId: string): Promise<void> { await securityApi.dismissAlert(alertId); this.publish({ alerts: this.state.alerts.filter((a) => a.id !== alertId) }); }
  async toggleFlag(key: keyof Pick<SecurityFlags, 'sessionStrictIpChecking'|'unrecognizedDeviceAlerts'|'enforce2FaForSensitiveActions'>): Promise<void> { const next = !this.state.flags[key]; const flags = await securityApi.setFlag(key, next); this.publish({ flags }); }
  async executePanicMode(): Promise<PanicExecutionResult> { const result = await securityApi.panic(); await this.refresh(); return result; }
  async resetPanicMode(): Promise<void> { await securityApi.clearPanic(); await this.refresh(); }
}

export const SecurityService = new SecurityServiceClass();
