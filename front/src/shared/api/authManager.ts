import { ApiError } from './httpClient';
import { tokenManager } from './tokenManager';
import { httpClient } from './httpClient';

/** Coordinates authentication lifecycle without owning UI state. */
export class AuthManager {
  private refreshPromise: Promise<string> | null = null;
  private csrfPromise: Promise<string> | null = null;

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
      throw error;
    }
  }

  clearSession(): void {
    tokenManager.clear();
    httpClient.setCsrfToken(null);
  }

  async ensureCsrf(force = false): Promise<string> {
    if (!force && this.csrfPromise) return this.csrfPromise;
    this.csrfPromise = httpClient.get<{ csrfToken: string }>('/auth/csrf', { skipAuth: true })
      .then((response) => {
        if (!response || typeof response.csrfToken !== 'string' || response.csrfToken.length < 16) {
          throw new ApiError('CSRF bootstrap failed', 502, 'CSRF_BOOTSTRAP_FAILED');
        }
        httpClient.setCsrfToken(response.csrfToken);
        return response.csrfToken;
      })
      .finally(() => { this.csrfPromise = null; });
    return this.csrfPromise;
  }

  async requireSession(): Promise<string> {
    const token = this.getAccessToken();
    if (token) return token;
    await this.ensureCsrf();
    return this.refreshSession();
  }
}

export const authManager = new AuthManager();
