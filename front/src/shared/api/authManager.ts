import { ApiError } from './httpClient';
import { tokenManager } from './tokenManager';
import { httpClient } from './httpClient';

/** Coordinates authentication lifecycle without owning UI state. */
export class AuthManager {
  private refreshPromise: Promise<string> | null = null;

  getAccessToken(): string | null { return tokenManager.getAccessToken(); }

  setAccessToken(token: string | null): void { tokenManager.setAccessToken(token); }

  async refreshSession(): Promise<string> {
    if (!this.refreshPromise) {
      this.refreshPromise = httpClient.refreshSession().finally(() => {
        this.refreshPromise = null;
      });
    }
    return this.refreshPromise;
  }

  clearSession(): void {
    tokenManager.clear();
  }

  async requireSession(): Promise<string> {
    const token = this.getAccessToken();
    if (token) return token;
    try { return await this.refreshSession(); }
    catch (error) { throw error instanceof ApiError ? error : new ApiError('Session unavailable', 401, 'SESSION_UNAVAILABLE'); }
  }
}

export const authManager = new AuthManager();
