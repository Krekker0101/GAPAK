export type AuditEventResponse = {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string;
  severity: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type SuspiciousFlagResponse = {
  id: string;
  reason: string;
  severity: string;
  status: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  reviewedAt?: string | null;
};

export type DeviceAlertResponse = {
  id: string;
  sessionId: string;
  channel: string;
  status: string;
  createdAt: string;
  acknowledgedAt?: string | null;
};

export type PanicModeRequest = {
  preserveCurrentSession: boolean;
  currentSessionId?: string;
  reason: string;
};

export type PanicModeResponse = {
  accepted: boolean;
  revokedSessionCount: number;
  revokedGrantCount: number;
  abortedUploadCount: number;
  auditEventId: string;
};
