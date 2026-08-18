export type RealtimeConnectionState =
  | 'CONNECTING'
  | 'AUTHENTICATING'
  | 'CONNECTED'
  | 'RECONNECTING'
  | 'CLOSED';

export type BackendRealtimeType =
  | 'auth'
  | 'subscribe'
  | 'unsubscribe'
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

export interface BackendRealtimeMessage {
  id?: string;
  type: BackendRealtimeType;
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

export interface BackendChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  senderDeviceId?: string | null;
  sequenceNumber: number;
  type: string;
  status: string;
  ciphertext: string;
  nonce: string;
  senderKeyId: string;
  encryptionProtocol: string;
  encryptionAlgorithm?: string;
  associatedData?: string | null;
  ratchetCounter?: number | null;
  authenticationTag?: string | null;
  content?: string | null;
  keyEnvelopes?: unknown[];
  metadata?: Record<string, unknown>;
  sentAt: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface HistoryRealtimeEvent {
  kind: 'history';
  requestId?: string;
  messages: BackendChatMessage[];
}

export interface ChatRealtimeEvent {
  kind: 'event';
  eventId: string;
  type:
    | 'chat.message.created'
    | 'chat.message.edited'
    | 'chat.message.deleted'
    | 'chat.read_receipt'
    | 'chat.typing';
  chatId?: string;
  messageId?: string;
  sequence?: number;
  data: unknown;
}

export interface AckRealtimeEvent {
  kind: 'ack';
  id?: string;
  ackFor?: string;
  type: 'ack' | 'read_receipt_ack' | 'delivery_ack';
  data: unknown;
}

export interface ErrorRealtimeEvent {
  kind: 'error';
  code?: string;
  message: string;
  details?: unknown;
}

export type RealtimeEvent =
  | HistoryRealtimeEvent
  | ChatRealtimeEvent
  | AckRealtimeEvent
  | ErrorRealtimeEvent;

export interface ChatSubscription {
  chatId: string;
  afterSequence?: number;
}
