import { authManager } from '../api/authManager';
import type { BackendRealtimeMessage } from './types';

/**
 * Establishes a valid browser session before the native WebSocket handshake.
 * The backend prefers the HttpOnly `gapak_at` cookie. A first-frame fallback
 * handles browsers that block cross-site cookies; credentials never enter the
 * WebSocket URL or intermediary access logs.
 */
export class RealtimeAuthentication {
  async createAuthenticationFrame(): Promise<BackendRealtimeMessage | null> {
    const token = await authManager.requireSession();
    if (!token) return null;
    return {
      type: 'auth',
      data: { token, browser_session: true },
    };
  }
}

export const realtimeAuthentication = new RealtimeAuthentication();
