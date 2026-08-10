/**
 * GAPAK Trust Rooms Domain Specifications & Contracts
 * Phase 5 - Private & High-Trust Spaces
 */

import { UserProfile } from './index';

export type TrustRoomPrivacy = 'SECRET' | 'PRIVATE';

export type TrustRoomAccessMode = 'INVITE_ONLY' | 'REQUEST' | 'OWNER_APPROVAL';

export type TrustRoomRole = 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER' | 'AUDITOR';

export type MessageRetentionMode = '24h' | '7d' | '30d' | 'forever' | 'burn_on_read';

export interface TrustRoomSettings {
  requireTwoFactor: boolean;
  minAccountAgeDays: number;
  messageRetention: MessageRetentionMode;
  expirationDays: number | null;
}

export interface TrustRoomMember {
  id: string;
  user: UserProfile;
  role: TrustRoomRole;
  joinedAt: string;
  hasTwoFactor: boolean;
  accountAgeDays: number;
  trustScore: number;
  status: 'active' | 'muted' | 'banned' | 'pending_approval';
}

export interface TrustRoomAuditLogItem {
  id: string;
  timestamp: string;
  actor: UserProfile;
  action: string;
  details: string;
  severity: 'info' | 'warn' | 'critical';
}

export interface TrustRoomMessage {
  id: string;
  author: UserProfile;
  text: string;
  createdAt: string;
  isEncrypted: boolean;
  attachments?: string[];
  expiresAt?: string;
}

export interface TrustRoom {
  id: string;
  title: string;
  description: string;
  avatarUrl?: string;
  coverUrl?: string;
  privacy: TrustRoomPrivacy;
  accessMode: TrustRoomAccessMode;
  settings: TrustRoomSettings;
  ownerId: string;
  memberCount: number;
  currentUserRole?: TrustRoomRole;
  createdAt: string;
  updatedAt: string;
  securityScore: number;
  members: TrustRoomMember[];
  pendingRequests: TrustRoomMember[];
  auditLogs: TrustRoomAuditLogItem[];
  messages: TrustRoomMessage[];
}
