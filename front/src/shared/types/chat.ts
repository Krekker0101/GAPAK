export type EnvelopeType = "TEXT" | "ATTACHMENT" | "KEY_EXCHANGE" | "SYSTEM";

export type CreateDirectChatRequest = {
  participantUserId: string;
};

export type SendMessageRequest = {
  clientMessageId: string;
  envelopeType: EnvelopeType;
  ciphertext: string;
  nonce: string;
  senderKeyId: string;
  attachmentManifest?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type ChatResponse = {
  id: string;
  participantIds: string[];
  lastMessageAt?: string | null;
  createdAt: string;
};

export type MessageResponse = {
  id: string;
  chatId: string;
  senderId: string;
  envelopeType: EnvelopeType;
  ciphertext: string;
  nonce: string;
  senderKeyId: string;
  attachmentManifest?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  clientMessageId: string;
  sentAt: string;
  editedAt?: string | null;
  attachments?: MessageAttachmentResponse[];
};

export type MessageAttachmentResponse = {
  mediaFileId: string;
  kind: string;
  status: string;
  originalName?: string | null;
  mimeType: string;
  sizeBytes: number;
};

export type ChatEventResponse = {
  id: string;
  sequence: number;
  channel: string;
  chatId: string;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
  relayedAt?: string | null;
};
