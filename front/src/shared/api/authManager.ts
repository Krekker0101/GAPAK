import { ApiError } from './httpClient';
import { tokenManager } from './tokenManager';
import { httpClient } from './httpClient';

/** Coordinates authentication lifecycle without owning UI state. */
export class AuthManager {
  private refreshPromise: Promise<string> | null = null;

  getAccessToken(): string | null { return tokenManager.getAccessToken(); }

  setAccessToken(token: string | null): void { tokenManager.setAccessToken(token); }

  setCsrfToken(token: string | null): void { httpClient.setCsrfToken(token); }

  async refreshSession(): Promise<string> {
    if (!this.refreshPromise) {
      this.refreshPromise = this.performRefreshWithCsrfRecovery()
        .finally(() => {
          this.refreshPromise = null;
        });
    }
    return this.refreshPromise;
  }

  private async performRefreshWithCsrfRecovery(): Promise<string> {
    try {
      return await httpClient.refreshSession();
    } catch (error) {
      // A CSRF cookie can legitimately expire before the long-lived refresh
      // cookie. Re-bootstrap the CSRF pair once, then retry the refresh.
      if (error instanceof ApiError && (error.status === 403 || error.code === 'CSRF_INVALID' || error.code === 'CSRF_FAILED')) {
        await this.ensureCsrf();
        return await httpClient.refreshSession();
      }
      throw error;
    }
  }

  clearSession(): void {
    tokenManager.clear();
    httpClient.setCsrfToken(null);
  }

  async ensureCsrf(): Promise<string> {
    return httpClient.get<{ csrfToken: string }>('/api/v1/auth/csrf', { skipAuth: true }).then((response) => {
      if (!response || typeof response.csrfToken !== 'string' || response.csrfToken.length < 16) {
        throw new ApiError('CSRF bootstrap failed', 502, 'CSRF_BOOTSTRAP_FAILED');
      }
      httpClient.setCsrfToken(response.csrfToken);
      return response.csrfToken;
    });
  }

  async requireSession(): Promise<string> {
    const token = this.getAccessToken();
    if (token) return token;
    try {
      // The refresh endpoint is protected by double-submit CSRF. Bootstrap the
      // CSRF cookie + matching in-memory header before sending refresh.
      await this.ensureCsrf();
      return await this.refreshSession();
    } catch (error) { throw error instanceof ApiError ? error : new ApiError('Session unavailable', 401, 'SESSION_UNAVAILABLE'); }
  }
}

export const authManager = new AuthManager();
