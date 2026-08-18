/** GAPAK authentication/session state. UI state only; API semantics live in authApi. */
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AuthState, UserProfile, PresenceStatus } from '../../shared/types';
import { ApiError } from '../../shared/api/httpClient';
import { authApi, LoginRequest, RegisterRequest, AnonymousRegisterRequest } from './api/authApi';
import { authManager } from '../../shared/api/authManager';
import { telemetry } from '../../shared/telemetry/telemetry';
import { realtimeManager } from '../../shared/realtime/RealtimeManager';
import { deviceCryptoManager } from '../chats/crypto/DeviceCryptoManager';
import type { BackendAuthUser, BackendProfile } from '../../shared/api/backendContracts';

export interface AuthContextValue {
  state: AuthState;
  user: UserProfile | null;
  error: ApiError | null;
  login: (input: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  anonymousRegister: (data: AnonymousRegisterRequest) => Promise<void>;
  verify2FA: (code: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (token: string, newPass: string) => Promise<void>;
  startOAuth: (provider: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutAllDevices: () => Promise<void>;
  expireSession: () => Promise<void>;
  setPresenceStatus: (presence: PresenceStatus) => void;
  clearError: () => void;
  restoreSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * The backend auth DTO intentionally does not contain frontend-only status/presence/trust fields.
 * Keep those fields absent rather than fabricating values. The UI type is widened at runtime only
 * where backend data is authoritative.
 */
const toUserRole = (role: string): UserProfile['role'] => {
  const allowed: readonly UserProfile['role'][] = ['guest', 'user', 'creator', 'moderator', 'security_analyst', 'admin', 'super_admin'];
  const normalized = role.trim().toLowerCase() as UserProfile['role'];
  return allowed.includes(normalized) ? normalized : 'guest';
};

const permissionsForRole = (role: UserProfile['role']): string[] => {
  if (role === 'admin' || role === 'super_admin') return ['*'];
  if (role === 'moderator') return ['admin:moderation:read'];
  if (role === 'security_analyst') return ['security:events:read', 'security:sessions:read', 'security:panic:execute'];
  return [];
};

const toUserProfile = (user: BackendAuthUser | BackendProfile): UserProfile => {
  const role = toUserRole(user.role);
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    ...(user.email ? { email: user.email } : {}),
    role,
    permissions: permissionsForRole(role),
    isAnonymous: user.isAnonymous,
    twoFactorEnabled: user.twoFactorEnabled,
  };
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>('UNKNOWN');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const hydrateSession = useCallback(async () => {
    setState('AUTHENTICATING');
    try {
      const token = await authManager.requireSession();
      if (!token) {
        authManager.clearSession();
        setUser(null);
        setState('UNAUTHENTICATED');
        return;
      }
      const profile = await authApi.me();
      setUser(toUserProfile(profile));
      setState('AUTHENTICATED');
      telemetry.record('auth', 'session_hydrated', 'info');
    } catch (err) {
      setUser(null);
      if (err instanceof ApiError && err.status !== 401 && err.status !== 403) {
        setError(err);
        setState('AUTH_ERROR');
      } else {
        authManager.clearSession();
        setState('UNAUTHENTICATED');
      }
    }
  }, []);

  useEffect(() => { void hydrateSession(); }, [hydrateSession]);
  useEffect(() => {
    const handleCrossTabLogout = () => {
      setUser(null);
      setState('UNAUTHENTICATED');
    };
    window.addEventListener('gapak:cross-tab-logout', handleCrossTabLogout);
    return () => window.removeEventListener('gapak:cross-tab-logout', handleCrossTabLogout);
  }, []);

  const applyAuthResponse = useCallback((response: { accessToken?: string; user?: BackendAuthUser; csrfToken?: string; session?: { id: string } }) => {
    if (!response.accessToken || !response.user) {
      throw new ApiError('Authentication response is incomplete', 502, 'INVALID_AUTH_RESPONSE');
    }
    authManager.setAccessToken(response.accessToken);
    if (!response.session?.id) {
      throw new ApiError('Authentication response is incomplete', 502, 'INVALID_AUTH_RESPONSE');
    }
    authManager.setSessionId(response.session.id);
    if (response.csrfToken) authManager.setCsrfToken(response.csrfToken);
    setUser(toUserProfile(response.user));
    setState('AUTHENTICATED');
  }, []);

  const hydrateAfterAuth = useCallback(async () => {
    const profile = await authApi.me();
    setUser(toUserProfile(profile));
    setState('AUTHENTICATED');
  }, []);

  const login = useCallback(async (input: LoginRequest) => {
    setState('AUTHENTICATING');
    setError(null);
    try {
      await authManager.ensureCsrf();
      const response = await authApi.login(input);
      applyAuthResponse(response);
      await hydrateAfterAuth();
      telemetry.record('auth', 'login_succeeded', 'info');
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : new ApiError(err instanceof Error ? err.message : 'Login failed', 401);
      setError(apiErr); setState('AUTH_ERROR'); telemetry.trackError('Login failed', apiErr); throw apiErr;
    }
  }, [applyAuthResponse, hydrateAfterAuth]);

  const register = useCallback(async (data: RegisterRequest) => {
    setState('AUTHENTICATING'); setError(null);
    try {
      await authManager.ensureCsrf();
      const response = await authApi.register({ ...data, preferAnonymous: false });
      applyAuthResponse(response);
      await hydrateAfterAuth();
      telemetry.record('auth', 'registration_succeeded', 'info');
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : new ApiError(err instanceof Error ? err.message : 'Registration failed', 400);
      setError(apiErr); setState('AUTH_ERROR'); throw apiErr;
    }
  }, [applyAuthResponse, hydrateAfterAuth]);

  const anonymousRegister = useCallback(async (data: AnonymousRegisterRequest) => {
    setState('AUTHENTICATING'); setError(null);
    try {
      await authManager.ensureCsrf();
      const response = await authApi.anonymousRegister(data);
      applyAuthResponse(response);
      await hydrateAfterAuth();
      telemetry.record('auth', 'anonymous_registration_succeeded', 'info');
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : new ApiError(err instanceof Error ? err.message : 'Anonymous registration failed', 400);
      setError(apiErr); setState('AUTH_ERROR'); throw apiErr;
    }
  }, [applyAuthResponse, hydrateAfterAuth]);

  const verify2FA = useCallback(async (code: string) => {
    setError(null);
    await authApi.twoFactorVerify(code);
    telemetry.record('auth', 'two_factor_verification_succeeded', 'info');
  }, []);

  const forgotPassword = useCallback(async (email: string) => { await authManager.ensureCsrf(); await authApi.forgotPassword(email); telemetry.record('auth', 'password_reset_requested', 'info'); }, []);
  const resetPassword = useCallback(async (token: string, newPass: string) => { await authManager.ensureCsrf(); await authApi.resetPassword(token, newPass); telemetry.record('auth', 'password_reset_succeeded', 'info'); }, []);

  const startOAuth = useCallback(async (provider: string) => {
    setState('AUTHENTICATING'); setError(null);
    try {
      await authManager.ensureCsrf();
      await authApi.startOAuth(provider);
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : new ApiError(err instanceof Error ? err.message : 'OAuth login failed', 502, 'OAUTH_START_FAILED');
      setError(apiErr); setState('AUTH_ERROR'); throw apiErr;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authManager.ensureCsrf();
      const result = await authApi.logout(false);
      if (!result.accepted) throw new ApiError('Server did not accept logout', 502, 'LOGOUT_NOT_ACCEPTED');
    } finally {
      realtimeManager.disconnect('logout'); realtimeManager.clearChatSubscriptions(); realtimeManager.broadcastLogout();
      await deviceCryptoManager.destroyAll(); authManager.clearSession(); queryClient.clear();
      setUser(null); setState('UNAUTHENTICATED');
    }
    telemetry.record('auth', 'logout_completed', 'info');
  }, [queryClient]);

  const logoutAllDevices = useCallback(async () => {
    try {
      await authManager.ensureCsrf();
      const result = await authApi.logoutAll();
      if (!result.accepted) throw new ApiError('Server did not accept logout-all', 502, 'LOGOUT_ALL_NOT_ACCEPTED');
    } finally {
      realtimeManager.disconnect('logout'); realtimeManager.clearChatSubscriptions(); realtimeManager.broadcastLogout();
      await deviceCryptoManager.destroyAll(); authManager.clearSession(); queryClient.clear();
      setUser(null); setState('UNAUTHENTICATED');
    }
    telemetry.record('auth', 'logout_all_completed', 'info');
  }, [queryClient]);

  const setPresenceStatus = useCallback((presence: PresenceStatus) => { setUser((prev) => prev ? { ...prev, presence } : prev); }, []);

  const expireSession = useCallback(async () => {
    realtimeManager.disconnect('authentication_failed');
    realtimeManager.clearChatSubscriptions();
    realtimeManager.broadcastLogout();
    authManager.clearSession();
    queryClient.clear();
    setUser(null);
    setError(null);
    setState('UNAUTHENTICATED');
    try {
      await deviceCryptoManager.destroyAll();
    } catch (cleanupError) {
      telemetry.trackError('Session cleanup failed', cleanupError);
    }
  }, [queryClient]);

  return (
    <AuthContext.Provider value={{ state, user, error, login, register, anonymousRegister, verify2FA, forgotPassword, resetPassword, startOAuth, logout, logoutAllDevices, expireSession, setPresenceStatus, clearError: () => setError(null), restoreSession: hydrateSession }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
