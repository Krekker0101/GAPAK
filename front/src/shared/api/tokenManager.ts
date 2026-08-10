/** Access tokens are memory-only. Refresh/session credentials are intentionally
 * not readable by JavaScript and are expected to be managed by HttpOnly cookies. */
export class TokenManager {
  private accessToken: string | null = null;

  getAccessToken(): string | null { return this.accessToken; }
  setAccessToken(token: string | null): void { this.accessToken = token; }
  clear(): void { this.accessToken = null; }
}

export const tokenManager = new TokenManager();
