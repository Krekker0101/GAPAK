import { httpClient } from '../../../shared/api/httpClient';
import { assertAuthResponse, assertUserProfile, AuthResponse } from '../../../shared/api/schemas';
import { UserProfile } from '../../../shared/types';

export interface LoginRequest { email: string; password: string; }
export interface RegisterRequest { email: string; password: string; username: string; displayName: string; }

export const authApi = {
  async login(input: LoginRequest): Promise<AuthResponse> {
    return assertAuthResponse(await httpClient.post('/api/auth/login', input));
  },
  async register(input: RegisterRequest): Promise<AuthResponse> {
    return assertAuthResponse(await httpClient.post('/api/auth/register', input));
  },
  async anonymousRegister(): Promise<AuthResponse> {
    return assertAuthResponse(await httpClient.post('/api/auth/register-anonymous'));
  },
  async verify2FA(code: string, challengeId?: string): Promise<AuthResponse> {
    return assertAuthResponse(await httpClient.post('/api/auth/2fa/verify', { code, ...(challengeId ? { challengeId } : {}) }));
  },
  async me(): Promise<UserProfile> {
    return assertUserProfile(await httpClient.get('/api/users/me'));
  },
  async forgotPassword(email: string): Promise<void> {
    await httpClient.post('/api/auth/forgot-password', { email });
  },
  async resetPassword(token: string, password: string): Promise<void> {
    await httpClient.post('/api/auth/reset-password', { token, password });
  },
  async oauthCallback(provider: string, code: string): Promise<AuthResponse> {
    return assertAuthResponse(await httpClient.post(`/api/auth/oauth/${encodeURIComponent(provider)}/callback`, { code }));
  },
  async logout(): Promise<void> {
    await httpClient.post('/api/auth/logout');
  },
  async logoutAll(): Promise<void> {
    await httpClient.post('/api/auth/logout-all');
  },
};
