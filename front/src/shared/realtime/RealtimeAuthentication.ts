import { authManager } from '../api/authManager';

/**
 * Establishes a valid browser session before the native WebSocket handshake.
 * The backend authenticates `/ws` from the HttpOnly `gapak_at` cookie; the
 * access token is never placed in the WebSocket URL.
 */
export class RealtimeAuthentication {
  async ensureAuthenticated(): Promise<boolean> {
    const token = await authManager.requireSession();
    return Boolean(token);
  }
}

export const realtimeAuthentication = new RealtimeAuthentication();
