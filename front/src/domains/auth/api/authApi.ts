import { ApiError, httpClient } from '../../../shared/api/httpClient';
import type { BackendAuthResponse, BackendProfile, LoginRequest as BackendLoginRequest, RegisterRequest as BackendRegisterRequest, AnonymousRegisterRequest as BackendAnonymousRegisterRequest } from '../../../shared/api/backendContracts';

export type LoginRequest = BackendLoginRequest;
export type RegisterRequest = Omit<BackendRegisterRequest, 'preferAnonymous'> & { preferAnonymous?: boolean };
export type AnonymousRegisterRequest = BackendAnonymousRegisterRequest;
export interface OAuthStartResponse { url: string; }

export const authApi = {
  async csrf(): Promise<string> {
    const response = await httpClient.bootstrapCsrf();
    return response.csrfToken;
  },
  login: (input: LoginRequest): Promise<BackendAuthResponse> =>
    httpClient.post<BackendAuthResponse>('/auth/login', input),
  register: (input: RegisterRequest): Promise<BackendAuthResponse> => {
    const payload: BackendRegisterRequest = { ...input, preferAnonymous: input.preferAnonymous ?? false };
    return httpClient.post<BackendAuthResponse>('/auth/register', payload);
  },
  anonymousRegister: (input: AnonymousRegisterRequest): Promise<BackendAuthResponse> =>
    httpClient.post<BackendAuthResponse>('/auth/register-anonymous', input),
  me: (signal?: AbortSignal): Promise<BackendProfile> => httpClient.get<BackendProfile>('/users/me', { signal }),
  forgotPassword: (email: string): Promise<void> => httpClient.post<void>('/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string): Promise<void> => httpClient.post<void>('/auth/reset-password', { token, newPassword: password }),
  twoFactorSetup: (signal?: AbortSignal) => httpClient.post<{ secret: string; otpAuthUrl: string }>('/auth/2fa/setup', undefined, { signal }),
  twoFactorVerify: (code: string, signal?: AbortSignal) => httpClient.post<{ accepted: boolean }>('/auth/2fa/verify', { code }, { signal }),
  twoFactorDisable: (signal?: AbortSignal) => httpClient.post<{ accepted: boolean }>('/auth/2fa/disable', undefined, { signal }),
  oauthRedirect: (provider: string, signal?: AbortSignal): Promise<OAuthStartResponse> => httpClient.get<OAuthStartResponse>(`/auth/oauth/${encodeURIComponent(provider)}`, { signal }),
  /** The OAuth callback is a browser redirect handled by the backend, not a JSON API call. */
  startOAuth: async (provider: string, signal?: AbortSignal): Promise<void> => {
    const response = await authApi.oauthRedirect(provider, signal);
    if (!response?.url || typeof response.url !== 'string') throw new ApiError('OAuth provider did not return a redirect URL', 502, 'INVALID_OAUTH_REDIRECT');
    const target = new URL(response.url, window.location.origin);
    const isLocalDevHttp = import.meta.env.DEV && (target.hostname === 'localhost' || target.hostname === '127.0.0.1');
    if (target.protocol !== 'https:' && !isLocalDevHttp) throw new ApiError('OAuth redirect URL must use HTTPS', 502, 'INVALID_OAUTH_REDIRECT');
    window.location.assign(target.toString());
  },
  logout: async (allDevices = false): Promise<{ accepted: boolean }> => {
    const response = await httpClient.post<{ accepted: boolean }>('/auth/logout', { allDevices });
    httpClient.clearSession();
    return response;
  },
  logoutAll: async (): Promise<{ accepted: boolean }> => {
    const response = await httpClient.post<{ accepted: boolean }>('/auth/logout', { allDevices: true });
    httpClient.clearSession();
    return response;
  },
};
