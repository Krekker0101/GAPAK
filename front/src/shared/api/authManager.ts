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
      let finalError: unknown = error;
      if (error instanceof ApiError && (error.status === 403 || error.code === 'CSRF_INVALID' || error.code === 'CSRF_FAILED')) {
        try {
          await this.ensureCsrf(true);
          return await httpClient.refreshSession();
        } catch (retryError) {
          finalError = retryError;
        }
      }
      // A refresh without a refresh cookie is the normal anonymous bootstrap
      // state. Do not surface it as an application error or start a retry loop.
      if (finalError instanceof ApiError && (finalError.status === 401 || finalError.status === 404)) {
        // A 404 can occur briefly when frontend and backend deployments roll
        // out at different times. It is not recoverable by retrying or by
        // clearing the browser cache, so reset only auth state and let the UI
        // present a clean login instead of trapping the whole application.
        this.clearSession();
        return '';
      }
      // The backend currently does not expose POST /auth/refresh at all on
      // some deployments (404 Not Found, not "refresh rejected"). That is a
      // missing/misconfigured route on the server, not a real auth failure —
      // treat it the same as "no session" instead of surfacing a hard error
      // or letting callers retry a route that can never succeed.
      throw finalError;
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
    // A forced recovery still joins an already-running bootstrap. Starting a
    // second request would create an avoidable race between its response and the
    // mutation retry (and historically invalidated the first token server-side).
    if (this.csrfPromise) return this.csrfPromise;
    void force;
    this.csrfPromise = httpClient.bootstrapCsrf()
      .then((response) => {
        this.hasServerSession = response.hasSession;
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
