import { ApiError } from './httpClient';
import { tokenManager } from './tokenManager';
import { httpClient } from './httpClient';

/** Coordinates authentication lifecycle without owning UI state. */
export class AuthManager {
  private refreshPromise: Promise<string> | null = null;
  private csrfPromise: Promise<string> | null = null;
  private hasServerSession = false;
  private sessionId: string | null = null;

  getAccessToken(): string | null { return tokenManager.getAccessToken(); }
  setAccessToken(token: string | null): void { tokenManager.setAccessToken(token); }
  setCsrfToken(token: string | null): void { httpClient.setCsrfToken(token); }

  async refreshSession(): Promise<string> {
    if (!this.refreshPromise) {
      this.refreshPromise = this.performRefreshWithCsrfRecovery().finally(() => { this.refreshPromise = null; });
    }
    return this.refreshPromise;
  }

  private async performRefreshWithCsrfRecovery(): Promise<string> {
    try {
      return await httpClient.refreshSession();
    } catch (error) {
      if (error instanceof ApiError && (error.status === 403 || error.code === 'CSRF_INVALID' || error.code === 'CSRF_FAILED')) {
        await this.ensureCsrf(true);
        return await httpClient.refreshSession();
      }
      // A refresh without a refresh cookie is the normal anonymous bootstrap
      // state. Do not surface it as an application error or start a retry loop.
      if (error instanceof ApiError && error.status === 401) {
        tokenManager.clear();
        return '';
      }
      throw error;
    }
  }

  setSessionId(sessionId: string | null): void { this.sessionId = sessionId; }
  getSessionId(): string | null { return this.sessionId; }

  clearSession(): void {
    tokenManager.clear();
    httpClient.setCsrfToken(null);
    this.hasServerSession = false;
    this.sessionId = null;
  }

  async ensureCsrf(force = false): Promise<string> {
    if (!force && this.csrfPromise) return this.csrfPromise;
    this.csrfPromise = httpClient.get<{ csrfToken: string; hasSession?: boolean }>('/auth/csrf', { skipAuth: true })
      .then((response) => {
        if (!response || typeof response.csrfToken !== 'string' || response.csrfToken.length < 16) {
          throw new ApiError('CSRF bootstrap failed', 502, 'CSRF_BOOTSTRAP_FAILED');
        }
        httpClient.setCsrfToken(response.csrfToken);
        this.hasServerSession = response.hasSession === true;
        return response.csrfToken;
      })
      .finally(() => { this.csrfPromise = null; });
    return this.csrfPromise;
  }

  async requireSession(): Promise<string> {
    const token = this.getAccessToken();
    if (token) return token;
    await this.ensureCsrf();
    if (!this.hasServerSession) return '';
    return this.refreshSession();
  }
}

export const authManager = new AuthManager();
