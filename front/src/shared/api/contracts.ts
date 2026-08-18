import type { ApiErrorResponse, HttpMethod } from '../types';
import type { Chat, ChatMessage, E2EEMessageEnvelope, PaginatedMessagesResponse, TrustedDevice } from '../types/chat';
import type { MediaAlbumPage, MediaPage, PlaybackGrantResponse, UploadCompleteResponse, UploadInitResponse } from '../types/media';
import type { AuditEvent, SecurityAlert, SecurityFlags, UserSession } from '../types/security';
import type { Story } from './backendContracts';
import type { LiveChatMessage, LiveStream } from './backendContracts';
import type { UserProfile } from '../types';
import type { ConnectionRequest, SubscriptionItem } from '../types/social';

export type ApiError = ApiErrorResponse;
export type CursorPage<T> = { items: T[]; nextCursor?: string | null; hasMore?: boolean };
export type ApiRequestMethod = HttpMethod;

export interface AuthLoginRequest { login: string; password: string; }
export interface AuthRegisterRequest { email: string; password: string; username: string; displayName: string; preferAnonymous?: boolean; }
export interface OAuthCallbackRequest { code: string; }
export interface AuthRefreshResponse { accessToken: string; expiresAt?: number; user?: UserProfile; csrfToken?: string; }

export interface ConnectionListResponse extends CursorPage<ConnectionRequest> {}
export interface ConnectionCreateRequest { userId: string; }
export interface SubscriptionListResponse extends CursorPage<SubscriptionItem> {}

export interface ChatListResponse extends CursorPage<Chat> { chats?: Chat[]; }
export interface ChatMessagePage extends PaginatedMessagesResponse {}
export interface ChatSendRequest extends E2EEMessageEnvelope {}
export interface TrustedDeviceListResponse { devices?: TrustedDevice[]; }

export type StoryFeedResponse = Story[];
export type MediaListResponse = MediaPage;
export type MediaAlbumsResponse = MediaAlbumPage;
export type MediaUploadInitResponse = UploadInitResponse;
export type MediaUploadCompleteResponse = UploadCompleteResponse;
export type MediaPlaybackGrantResponse = PlaybackGrantResponse;

export interface SecurityStateContract {
  sessions: UserSession[];
  auditEvents: AuditEvent[];
  alerts: SecurityAlert[];
  flags: SecurityFlags;
  twoFactorEnabled: boolean;
}

export interface NotificationContract {
  id: string;
  type: string;
  title: string;
  body?: string;
  createdAt: string;
  readAt?: string | null;
}

export interface LiveListResponse extends CursorPage<LiveStream> {}
export interface LiveChatResponse extends CursorPage<LiveChatMessage> {}
export type LivePlaybackGrantResponse = PlaybackGrantResponse;

export type WebSocketEventName =
  | 'history'
  | 'chat.message.created'
  | 'chat.message.edited'
  | 'chat.message.deleted'
  | 'chat.read_receipt'
  | 'chat.typing'
  | 'ack'
  | 'read_receipt_ack'
  | 'delivery_ack'
  | 'error';

export interface WebSocketMessageContract {
  id?: string;
  type: WebSocketEventName | 'subscribe' | 'unsubscribe';
  data?: unknown;
  ackFor?: string;
  eventId?: string;
  chatId?: string;
  messageId?: string;
  senderId?: string;
  senderDeviceId?: string;
  sequence?: number;
  clientMessageId?: string;
}
