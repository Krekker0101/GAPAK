/**
 * GAPAK Security Center Types
 * Specification for Enterprise Security, Sessions, 2FA, Audit Logs, and Panic Mode
 */

export interface UserSession {
  id: string;
  device: string;
  browser: string;
  ip: string;
  location?: string;
  lastActivity: string;
  createdAt: string;
  isCurrent: boolean;
  isSuspicious: boolean;
  trustScore?: number;
}

export interface TwoFactorState {
  enabled: boolean;
  method?: 'totp' | 'security_key';
  verifiedAt?: string;
  backupCodesRemaining: number;
}

export interface TwoFactorSetupData {
  setupId?: string;
  qrCodeUrl: string;
  secretKey: string;
  manualEntryCode: string;
}

export type AuditSeverity = 'info' | 'notice' | 'warning' | 'critical';

export interface AuditEvent {
  id: string;
  timestamp: string;
  type:
    | 'LOGIN_SUCCESS'
    | 'LOGIN_FAILED'
    | 'SESSION_REVOKED'
    | 'ALL_OTHER_SESSIONS_REVOKED'
    | '2FA_ENABLED'
    | '2FA_DISABLED'
    | 'PANIC_MODE_EXECUTED'
    | 'GRANT_REVOKED'
    | 'PASSWORD_CHANGED'
    | 'SUSPICIOUS_ACTIVITY_DETECTED'
    | 'REPORT_SUBMITTED';
  severity: AuditSeverity;
  device: string;
  ip: string;
  location?: string;
  details: Record<string, string | number | boolean>;
}

export interface SecurityAlert {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  isRead: boolean;
  actionLabel?: string;
  actionType?: 'REVOKE_SESSIONS' | 'ENABLE_2FA' | 'REVIEW_LOGS' | 'DISMISS';
}

export interface SecurityFlags {
  panicModeActive: boolean;
  sessionStrictIpChecking: boolean;
  unrecognizedDeviceAlerts: boolean;
  enforce2FaForSensitiveActions: boolean;
  lastPanicTriggeredAt?: string;
}

export interface PanicExecutionResult {
  revokedSessionCount: number;
  revokedGrantCount: number;
  abortedUploadCount: number;
  timestamp: string;
  success: boolean;
}
