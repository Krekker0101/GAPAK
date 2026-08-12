import { httpClient } from '../../../shared/api/httpClient';
import { UserPresenceData, PresenceStatus } from '../../../shared/types';
import { authManager } from '../../../shared/api/authManager';

class PresenceEngineService {
  private store = new Map<string, UserPresenceData>();
  private lastActivity = Date.now();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private cleanup: () => void = () => {};

  constructor() {
    if (typeof window !== 'undefined') {
      const update = () => { this.lastActivity = Date.now(); };
      window.addEventListener('mousemove', update, { passive: true });
      window.addEventListener('keydown', update, { passive: true });
      window.addEventListener('touchstart', update, { passive: true });
      this.cleanup = () => {
        window.removeEventListener('mousemove', update);
        window.removeEventListener('keydown', update);
        window.removeEventListener('touchstart', update);
      };
    }
  }

  start(_userId: string) {
    this.stop();
    this.heartbeatTimer = setInterval(() => { void this.sendHeartbeat(); }, 20_000);
    void this.sendHeartbeat();
  }

  stop() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  async sendHeartbeat(): Promise<void> {
    const sessionId = authManager.getSessionId();
    if (!sessionId) return;
    const state = Date.now() - this.lastActivity > 300_000 ? 'IDLE' : 'ACTIVE';
    try {
      await httpClient.post('/presence/heartbeat', { connectionId: sessionId, state });
    } catch {
      // Presence is server-owned; a failed heartbeat must not fabricate local presence state.
    }
  }

  async updateMyPresence(_userId: string, status: PresenceStatus): Promise<void> {
    // The backend exposes no PATCH /presence/me or custom-status mutation.
    // Map supported UI states onto the documented heartbeat state only.
    const sessionId = authManager.getSessionId();
    if (!sessionId) return;
    const state = status === 'online' ? 'ACTIVE' : 'IDLE';
    await httpClient.post('/presence/heartbeat', { connectionId: sessionId, state });
  }

  async getUserPresence(userId: string) {
    const cached = this.store.get(userId);
    if (cached) return cached;
    const data = await httpClient.get<UserPresenceData>(`/presence/users/${encodeURIComponent(userId)}`);
    this.store.set(userId, data);
    return data;
  }

  async queryPresences(userIds: string[]) {
    const data = await httpClient.post<Record<string, UserPresenceData>>('/presence/query', { userIds });
    Object.entries(data).forEach(([id, presence]) => this.store.set(id, presence));
    return data;
  }

  dispose() { this.stop(); this.cleanup(); }
}

export const presenceEngine = new PresenceEngineService();
