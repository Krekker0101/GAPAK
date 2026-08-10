/**
 * GAPAK Moderation Types
 * Specification for User Reporting and Moderation History
 */

export type ReportTargetType = 'USER' | 'POST' | 'TRUST_ROOM' | 'MEDIA';

export type ReportReason = 'HARASSMENT' | 'SPAM' | 'ILLEGAL_CONTENT' | 'IMPERSONATION';

export type ReportStatus = 'PENDING' | 'UNDER_REVIEW' | 'ACTION_TAKEN' | 'DISMISSED';

export interface ReportSubmission {
  targetType: ReportTargetType;
  targetId: string;
  targetTitle: string;
  reason: ReportReason;
  description: string;
}

export interface UserReport {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  targetTitle: string;
  reason: ReportReason;
  description: string;
  status: ReportStatus;
  createdAt: string;
  updatedAt: string;
  resolutionNote?: string;
}
