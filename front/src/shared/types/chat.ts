/**
 * GAPAK Realtime E2EE Messenger Domain Types
 * Phase 3 - E2EE Architecture, Transport, Crypto, & Protocol
 */

import { UserProfile, PresenceStatus } from './index';

// --- Chat Types ---
export type ChatType = 'DIRECT' | 'GROUP' | 'CHANNEL' | 'BROADCAST';

export type MemberRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'SUBSCRIBER';

export interface ChatMember {
  id: string;
  userId: string;
  user: UserProfile;
  role: MemberRole;
  joinedAt: string;
  keyFingerprint?: string;
  isMuted?: boolean;
}

export interface Chat {
  id: string;
  type: ChatType;
  title?: string;
  description?: string;
  avatarUrl?: string;
  members: ChatMember[];
  lastMessage?: ChatMessage;
  unreadCount: number;
  pinnedMessageIds: string[];
  isEncrypted: boolean;
  ephemeralTimerSeconds?: number;
  createdAt: string;
  updatedAt: string;
  directPeer?: Pick<UserProfile, 'id' | 'username' | 'displayName' | 'avatarUrl'>;
}

// --- Message Content & States ---
export type MessageContentType =
  | 'TEXT'
  | 'IMAGE'
  | 'VIDEO'
  | 'AUDIO'
  | 'DOCUMENT'
  | 'VOICE'
  | 'STICKER'
  | 'SYSTEM'
  | 'LOCATION'
  | 'CONTACT';

export type MessageState =
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'
  | 'retrying'
  | 'expired'
  | 'deleted'
  | 'edited'
  | 'encrypted'
  | 'decryption_failed';

export interface EncryptedAttachment {
  id: string;
  mediaFileId: string;
  name: string;
  type: 'image' | 'video' | 'audio' | 'document' | 'voice' | 'sticker';
  sizeBytes: number;
  /** Optional local preview. Remote content is always obtained through a short-lived playback grant. */
  encryptedBlobUrl?: string;
  nonce?: string;
  mimeType: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  waveform?: number[];
}

export interface MessageReaction {
  emoji: string;
  count: number;
  users: string[]; // User IDs
  reactedByMe?: boolean;
}

export interface MessageVersion {
  version: number;
  body: string;
  editedAt: string;
}

// --- Wire E2EE Envelope Contract (Backend API format) ---
export interface E2EEMessageEnvelope {
  id: string;
  /** Client-generated id used to reconcile optimistic sends with the server-issued message id. */
  clientMessageId?: string;
  chatId: string;
  senderId: string;
  senderKeyId: string;
  content: null; // MUST remain null over network/API
  protocolVersion: 'gapak-e2ee-v1';
  ciphertext: string; // Hex-encoded AES-GCM ciphertext + authentication tag
  nonce: string; // Hex-encoded AES-GCM IV
  keyEnvelopes: Record<string, string>; // deviceId -> ephemeral public key + salt metadata
  ratchetCounter: number; // Sender-device monotonic sequence; backend MUST enforce replay protection.
  senderDeviceId: string;
  keyVersion: number;
  authenticationTag: string; // ECDSA signature bytes encoded as hex; legacy field name retained for wire compatibility.
  attachments?: EncryptedAttachment[];
  contentType: MessageContentType;
  createdAt: string;
  expiresAt?: string;
  replyToMessageId?: string;
}

// --- Decrypted Client-Side Message Model ---
export interface ChatMessage {
  id: string;
  clientMessageId?: string;
  chatId: string;
  sender: UserProfile;
  senderKeyId: string;
  content: string; // Decrypted text
  contentType: MessageContentType;
  state: MessageState;
  createdAt?: string;
  updatedAt?: string;
  expiresAt?: string;
  replyToMessageId?: string;
  replyTo?: ChatMessage;
  versions?: MessageVersion[];
  reactions: MessageReaction[];
  readByUserIds?: string[];
  deliveredToUserIds?: string[];
  pinned?: boolean;
  attachments?: EncryptedAttachment[];
  location?: { lat: number; lng: number; label?: string };
  contact?: { name: string; phone?: string; avatarUrl?: string };
  voice?: { durationSeconds: number; waveform: number[] };
  decryptionError?: string;
}

// --- Trusted Devices & Pre-keys ---
export type DeviceType = 'mobile' | 'desktop' | 'tablet' | 'web';
export type VerificationStatus = 'VERIFIED' | 'UNVERIFIED' | 'CHANGED' | 'REVOKED' | 'UNKNOWN';

export interface TrustedDevice {
  id: string;
  name: string;
  type: DeviceType;
  identityKeyFingerprint: string;
  signingKeyFingerprint: string;
  preKeysRemaining: number;
  verificationStatus: VerificationStatus;
  lastActiveAt: string;
  isCurrentDevice: boolean;
  registeredAt: string;
}

export interface PreKeyBundle {
  registrationId: number;
  identityKey: string;
  signedPreKey: string;
  oneTimePreKeys: string[];
}

// --- Realtime & Presence ---
export interface TypingState {
  chatId: string;
  userId: string;
  username: string;
  isTyping: boolean;
  timestamp: number;
}

export interface UserPresenceData {
  userId: string;
  status: PresenceStatus;
  lastSeen: string;
  customStatus?: string;
}

export interface KeysetPaginationCursor {
  cursor?: string;
  limit: number;
  direction: 'before' | 'after';
}

export interface PaginatedMessagesResponse {
  messages: ChatMessage[];
  hasMoreBefore: boolean;
  hasMoreAfter: boolean;
  nextCursorBefore?: string;
  nextCursorAfter?: string;
}
