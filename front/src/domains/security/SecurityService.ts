/** Server-backed security domain service. Only backend-authoritative state is exposed. */
import type {
  AuditEvent,
  BackendProfile,
  BackendSession,
  DeviceAlert,
  PanicModeResponse,
  SecurityFlag,
  TrustedDevice,
} from '../../shared/api/backendContracts';
import { securityApi, type SecurityStateResponse } from './api/securityApi';

export interface SecurityState extends SecurityStateResponse {
  devices: TrustedDevice[];
}

type Listener = (state: SecurityState | null) => void;

class SecurityServiceClass {
  private state: SecurityState | null = null;
  private listeners = new Set<Listener>();
  private loadPromise: Promise<SecurityState> | null = null;

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  getState(): SecurityState | null {
    return this.state;
  }

  private publish(next: SecurityState) {
    this.state = next;
    this.listeners.forEach((listener) => listener(next));
  }

  async load(signal?: AbortSignal): Promise<SecurityState> {
    if (this.loadPromise) return this.loadPromise;
    this.loadPromise = Promise.all([securityApi.state(signal), securityApi.devices(signal)])
      .then(([security, devices]) => {
        const next = { ...security, devices };
        this.publish(next);
        return next;
      })
      .finally(() => { this.loadPromise = null; });
    return this.loadPromise;
  }

  async refresh(): Promise<SecurityState> {
    return this.load();
  }

  async getSessions(): Promise<BackendSession[]> {
    const sessions = await securityApi.sessions();
    const state = this.requireState();
    this.publish({ ...state, sessions });
    return sessions;
  }

  async revokeSession(sessionId: string): Promise<void> {
    await securityApi.revokeSession(sessionId);
    await this.refresh();
  }

  async revokeOtherSessions(): Promise<void> {
    await securityApi.revokeOtherSessions();
    await this.refresh();
  }

  async getDevices(): Promise<TrustedDevice[]> {
    const devices = await securityApi.devices();
    const state = this.requireState();
    this.publish({ ...state, devices });
    return devices;
  }

  async revokeDevice(deviceId: string): Promise<void> {
    await securityApi.revokeDevice(deviceId);
    await this.getDevices();
  }

  async get2FaSetupData() {
    return securityApi.twoFactorSetup();
  }

  async verifyAndEnable2Fa(code: string) {
    const result = await securityApi.twoFactorVerify(code);
    const state = this.requireState();
    this.publish({ ...state, twoFactor: { enabled: result.accepted } });
    return { success: result.accepted, message: result.accepted ? 'Two-Factor Authentication enabled.' : 'Two-Factor Authentication was not accepted.' };
  }

  async disable2Fa(): Promise<void> {
    const result = await securityApi.twoFactorDisable();
    const state = this.requireState();
    this.publish({ ...state, twoFactor: { enabled: !result.accepted } });
  }

  async executePanicMode(input: { preserveCurrentSession: boolean; currentSessionId?: string; reason: string }): Promise<PanicModeResponse> {
    const result = await securityApi.panic(input);
    await this.refresh();
    return result;
  }

  private requireState(): SecurityState {
    if (!this.state) throw new Error('Security state has not been loaded.');
    return this.state;
  }
}

export const SecurityService = new SecurityServiceClass();

export type { AuditEvent, BackendProfile, BackendSession, DeviceAlert, PanicModeResponse, SecurityFlag, TrustedDevice };
