import { ApiError, httpClient } from '../../../shared/api/httpClient';
import { authManager } from '../../../shared/api/authManager';
import { assertAuthResponse, assertUserProfile, AuthResponse } from '../../../shared/api/schemas';
import { UserProfile } from '../../../shared/types';

export interface LoginRequest { email: string; password: string; }
export interface RegisterRequest { email?: string; password: string; username: string; displayName: string; preferAnonymous?: boolean; }


async function withCsrfRecovery<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof ApiError && error.status === 403 && (error.code === 'security.invalid_csrf' || error.code === 'CSRF_INVALID' || error.code === 'CSRF_FAILED')) {
      await authManager.ensureCsrf(true);
      return operation();
    }
    throw error;
  }
}

export const authApi = {
  async csrf(): Promise<string> {
    const response = await httpClient.get<{ csrfToken: string }>('/auth/csrf', { skipAuth: true });
    if (!response || typeof response.csrfToken !== 'string' || response.csrfToken.length < 16) {
      throw new Error('CSRF bootstrap failed');
    }
    httpClient.setCsrfToken(response.csrfToken);
    return response.csrfToken;
  },
  async login(input: LoginRequest): Promise<AuthResponse> {
    // Backend LoginRequest uses the `login` field and accepts either email or username.
    return assertAuthResponse(await withCsrfRecovery(() => httpClient.post('/auth/login', { login: input.email, password: input.password })));
  },
  async register(input: RegisterRequest): Promise<AuthResponse> {
    return assertAuthResponse(await withCsrfRecovery(() => httpClient.post('/auth/register', { ...input, email: undefined, preferAnonymous: true })));
  },
  async anonymousRegister(input: RegisterRequest): Promise<AuthResponse> {
    // Keep the anonymous endpoint available for flows that explicitly request it,
    // but send a valid JSON RegisterRequest. The backend intentionally converts
    // this request into an anonymous account and ignores the email address.
    return assertAuthResponse(await withCsrfRecovery(() => httpClient.post('/auth/register-anonymous', input))); 
  },
  async verify2FA(code: string, challengeId?: string): Promise<AuthResponse> {
    return assertAuthResponse(await withCsrfRecovery(() => httpClient.post('/auth/2fa/verify', { code, ...(challengeId ? { challengeId } : {}) })));
  },
  async me(): Promise<UserProfile> {
    return assertUserProfile(await httpClient.get('/users/me'));
  },
  async forgotPassword(email: string): Promise<void> {
    await withCsrfRecovery(() => httpClient.post('/auth/forgot-password', { email }));
  },
  async resetPassword(token: string, password: string): Promise<void> {
    await withCsrfRecovery(() => httpClient.post('/auth/reset-password', { token, newPassword: password }));
  },
  async oauthCallback(provider: string, code: string): Promise<AuthResponse> {
    return assertAuthResponse(await withCsrfRecovery(() => httpClient.post(`/auth/oauth/${encodeURIComponent(provider)}`, { code })));
  },
  async logout(): Promise<void> {
    await withCsrfRecovery(() => httpClient.post('/auth/logout'));
  },
  async logoutAll(): Promise<void> {
    await withCsrfRecovery(() => httpClient.post('/auth/logout', { allDevices: true }));
  },
};
