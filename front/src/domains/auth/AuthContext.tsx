/** GAPAK authentication/session state. UI state only; API semantics live in authApi. */
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AuthState, UserProfile, PresenceStatus } from '../../shared/types';
import { ApiError } from '../../shared/api/httpClient';
import { authApi } from './api/authApi';
import { authManager } from '../../shared/api/authManager';
import { telemetry } from '../../shared/telemetry/telemetry';
import { realtimeManager } from '../../shared/realtime/RealtimeManager';
import { deviceCryptoManager } from '../chats/crypto/DeviceCryptoManager';

export interface AuthContextValue {
  state: AuthState;
  user: UserProfile | null;
  error: ApiError | null;
  requires2FA: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email?: string; password: string; username: string; displayName: string; preferAnonymous?: boolean }) => Promise<void>;
  anonymousRegister: (data: { email?: string; password: string; username: string; displayName: string; preferAnonymous?: boolean }) => Promise<void>;
  verify2FA: (code: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (token: string, newPass: string) => Promise<void>;
  handleOAuthCallback: (provider: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutAllDevices: () => Promise<void>;
  setPresenceStatus: (presence: PresenceStatus) => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>('UNKNOWN');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [requires2FA, setRequires2FA] = useState(false);
  const twoFactorChallengeId = useRef<string | undefined>(undefined);

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
      setUser(profile);
      setState('AUTHENTICATED');
      telemetry.record('auth', 'session_hydrated', 'info');
    } catch (err) {
      authManager.clearSession();
      setUser(null);
      if (err instanceof ApiError && err.status !== 401 && err.status !== 403) setState('AUTH_ERROR');
      else setState('UNAUTHENTICATED');
    }
  }, []);

  useEffect(() => { void hydrateSession(); }, [hydrateSession]);
  useEffect(() => {
    const handleCrossTabLogout = () => {
      setUser(null);
      setRequires2FA(false);
      twoFactorChallengeId.current = undefined;
      setState('UNAUTHENTICATED');
    };
    window.addEventListener('gapak:cross-tab-logout', handleCrossTabLogout);
    return () => window.removeEventListener('gapak:cross-tab-logout', handleCrossTabLogout);
  }, []);

  const applyAuthResponse = useCallback((response: { accessToken?: string; user?: UserProfile; requires2FA?: boolean; challengeId?: string; csrfToken?: string }) => {
    if (response.requires2FA) {
      twoFactorChallengeId.current = response.challengeId;
      if (response.csrfToken) authManager.setCsrfToken(response.csrfToken);
      setRequires2FA(true);
      setState('AUTHENTICATING');
      return false;
    }
    if (!response.accessToken || !response.user) {
      throw new ApiError('Authentication response is incomplete', 502, 'INVALID_AUTH_RESPONSE');
    }
    authManager.setAccessToken(response.accessToken);
    if (response.csrfToken) authManager.setCsrfToken(response.csrfToken);
    setUser(response.user);
    setRequires2FA(false);
    twoFactorChallengeId.current = undefined;
    setState('AUTHENTICATED');
    return true;
  }, []);

  const hydrateAfterAuth = useCallback(async () => {
    const profile = await authApi.me();
    setUser(profile);
    setState('AUTHENTICATED');
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setState('AUTHENTICATING');
    setError(null);
    try {
      await authManager.ensureCsrf();
      const response = await authApi.login({ email, password });
      if (applyAuthResponse(response)) await hydrateAfterAuth();
      telemetry.record('auth', 'login_succeeded', 'info');
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : new ApiError(err instanceof Error ? err.message : 'Login failed', 401);
      setError(apiErr); setState('AUTH_ERROR'); telemetry.trackError('Login failed', apiErr); throw apiErr;
    }
  }, [applyAuthResponse, hydrateAfterAuth]);

  const register = useCallback(async (data: { email?: string; password: string; username: string; displayName: string; preferAnonymous?: boolean }) => {
    setState('AUTHENTICATING'); setError(null);
    try {
      await authManager.ensureCsrf();
      const response = await authApi.register(data);
      if (applyAuthResponse(response)) await hydrateAfterAuth();
      telemetry.record('auth', 'registration_succeeded', 'info');
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : new ApiError(err instanceof Error ? err.message : 'Registration failed', 400);
      setError(apiErr); setState('AUTH_ERROR'); throw apiErr;
    }
  }, [applyAuthResponse, hydrateAfterAuth]);

  const anonymousRegister = useCallback(async (data: { email?: string; password: string; username: string; displayName: string; preferAnonymous?: boolean }) => {
    setState('AUTHENTICATING'); setError(null);
    try {
      await authManager.ensureCsrf();
      const response = await authApi.anonymousRegister(data);
      if (applyAuthResponse(response)) await hydrateAfterAuth();
      telemetry.record('auth', 'anonymous_registration_succeeded', 'info');
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : new ApiError(err instanceof Error ? err.message : 'Anonymous registration failed', 400);
      setError(apiErr); setState('AUTH_ERROR'); throw apiErr;
    }
  }, [applyAuthResponse, hydrateAfterAuth]);

  const verify2FA = useCallback(async (code: string) => {
    setState('AUTHENTICATING'); setError(null);
    try {
      const response = await authApi.verify2FA(code, twoFactorChallengeId.current);
      if (applyAuthResponse(response)) await hydrateAfterAuth();
      telemetry.record('auth', 'two_factor_verification_succeeded', 'info');
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : new ApiError(err instanceof Error ? err.message : '2FA verification failed', 400);
      setError(apiErr); setState('AUTH_ERROR'); throw apiErr;
    }
  }, [applyAuthResponse, hydrateAfterAuth]);

  const forgotPassword = useCallback(async (email: string) => { await authManager.ensureCsrf(); await authApi.forgotPassword(email); telemetry.record('auth', 'password_reset_requested', 'info'); }, []);
  const resetPassword = useCallback(async (token: string, newPass: string) => { await authManager.ensureCsrf(); await authApi.resetPassword(token, newPass); telemetry.record('auth', 'password_reset_succeeded', 'info'); }, []);

  const handleOAuthCallback = useCallback(async (provider: string, code: string) => {
    setState('AUTHENTICATING'); setError(null);
    try { await authManager.ensureCsrf(); const response = await authApi.oauthCallback(provider, code); if (applyAuthResponse(response)) await hydrateAfterAuth(); telemetry.record('auth', 'oauth_login_succeeded', 'info'); }
    catch (err) { const apiErr = err instanceof ApiError ? err : new ApiError(err instanceof Error ? err.message : 'OAuth login failed', 401); setError(apiErr); setState('AUTH_ERROR'); throw apiErr; }
  }, [applyAuthResponse, hydrateAfterAuth]);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch (err) { telemetry.trackError('Logout request failed', err); }
    finally { realtimeManager.disconnect('logout'); realtimeManager.clearChatSubscriptions(); realtimeManager.broadcastLogout(); await deviceCryptoManager.destroyAll(); authManager.clearSession(); queryClient.clear(); setUser(null); setRequires2FA(false); twoFactorChallengeId.current = undefined; setState('UNAUTHENTICATED'); telemetry.record('auth', 'logout_completed', 'info'); }
  }, [queryClient]);

  const logoutAllDevices = useCallback(async () => {
    try { await authApi.logoutAll(); } finally { realtimeManager.disconnect('logout'); realtimeManager.clearChatSubscriptions(); realtimeManager.broadcastLogout(); await deviceCryptoManager.destroyAll(); authManager.clearSession(); queryClient.clear(); setUser(null); setRequires2FA(false); twoFactorChallengeId.current = undefined; setState('UNAUTHENTICATED'); telemetry.record('auth', 'logout_all_completed', 'info'); }
  }, [queryClient]);

  const setPresenceStatus = useCallback((presence: PresenceStatus) => { setUser((prev) => prev ? { ...prev, presence } : prev); }, []);

  return (
    <AuthContext.Provider value={{ state, user, error, requires2FA, login, register, anonymousRegister, verify2FA, forgotPassword, resetPassword, handleOAuthCallback, logout, logoutAllDevices, setPresenceStatus, clearError: () => setError(null) }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
