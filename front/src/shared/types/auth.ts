export type AuthUser = {
  id: string;
  email?: string | null;
  username: string;
  displayName: string;
  role: string;
  isAnonymous: boolean;
  twoFactorEnabled: boolean;
};

export type AuthSession = {
  id: string;
  deviceName?: string;
  userAgent?: string;
  ipAddress?: string;
  securityLevel: string;
  lastUsedAt: string;
  expiresAt: string;
  createdAt: string;
};

export type AuthResponse = {
  user: AuthUser;
  session: AuthSession;
  accessToken: string;
  accessTokenTtl: number;
  refreshTokenTtl: number;
  csrfToken: string;
  refreshExpiresAt: string;
};

export type RegisterRequest = {
  email?: string;
  username: string;
  displayName: string;
  password: string;
  preferAnonymous: boolean;
  deviceName?: string;
  deviceFingerprint?: string;
};

export type LoginRequest = {
  login: string;
  password: string;
  totpCode?: string;
  deviceName?: string;
  deviceFingerprint?: string;
};

export type RefreshRequest = {
  refreshToken?: string;
};

export type LogoutRequest = {
  allDevices: boolean;
};

export type ForgotPasswordRequest = {
  email: string;
};

export type ResetPasswordRequest = {
  token: string;
  newPassword: string;
};

export type VerifyTwoFactorRequest = {
  code: string;
};

export type AcceptedResponse = {
  accepted: boolean;
};

export type TwoFactorSetupResponse = {
  secret: string;
  otpAuthUrl: string;
};
