export type SessionResponse = {
  id: string;
  deviceName?: string;
  userAgent?: string;
  ipAddress?: string;
  countryCode?: string;
  city?: string;
  securityLevel: string;
  isCurrent: boolean;
  lastUsedAt: string;
  expiresAt: string;
  createdAt: string;
  revokedAt?: string | null;
};
