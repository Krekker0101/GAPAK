import { authManager } from '../api/authManager';

/** Realtime authentication boundary. The browser WebSocket handshake itself is cookie/session authenticated. */
export class RealtimeAuthentication {
  async ensureAuthenticated(): Promise<void> {
    await authManager.requireSession();
  }
}
export const realtimeAuthentication = new RealtimeAuthentication();
