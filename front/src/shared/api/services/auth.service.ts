import { apiClient } from "@/shared/api/client";
import type {
  AcceptedResponse,
  AuthResponse,
  ForgotPasswordRequest,
  LoginRequest,
  LogoutRequest,
  RegisterRequest,
  ResetPasswordRequest,
  TwoFactorSetupResponse,
  VerifyTwoFactorRequest,
} from "@/shared/types/auth";

export const authService = {
  csrf() {
    return apiClient<{ csrfToken: string }>({
      path: "/auth/csrf",
      method: "GET",
      auth: false,
      retryOnAuth: false,
    });
  },
  register(payload: RegisterRequest) {
    return apiClient<AuthResponse>({
      path: "/auth/register",
      method: "POST",
      body: payload,
      auth: false,
      retryOnAuth: false,
    });
  },
  registerAnonymous(payload: RegisterRequest) {
    return apiClient<AuthResponse>({
      path: "/auth/register-anonymous",
      method: "POST",
      body: payload,
      auth: false,
      retryOnAuth: false,
    });
  },
  login(payload: LoginRequest) {
    return apiClient<AuthResponse>({
      path: "/auth/login",
      method: "POST",
      body: payload,
      auth: false,
      retryOnAuth: false,
    });
  },
  refresh() {
    return apiClient<AuthResponse>({
      path: "/auth/refresh",
      method: "POST",
      auth: false,
      retryOnAuth: false,
    });
  },
  logout(payload: LogoutRequest) {
    return apiClient<AcceptedResponse>({
      path: "/auth/logout",
      method: "POST",
      body: payload,
      retryOnAuth: false,
    });
  },
  forgotPassword(payload: ForgotPasswordRequest) {
    return apiClient<AcceptedResponse>({
      path: "/auth/forgot-password",
      method: "POST",
      body: payload,
      auth: false,
      retryOnAuth: false,
    });
  },
  resetPassword(payload: ResetPasswordRequest) {
    return apiClient<AcceptedResponse>({
      path: "/auth/reset-password",
      method: "POST",
      body: payload,
      auth: false,
      retryOnAuth: false,
    });
  },
  setupTwoFactor() {
    return apiClient<TwoFactorSetupResponse>({
      path: "/auth/2fa/setup",
      method: "POST",
    });
  },
  verifyTwoFactor(payload: VerifyTwoFactorRequest) {
    return apiClient<AcceptedResponse>({
      path: "/auth/2fa/verify",
      method: "POST",
      body: payload,
    });
  },
};
