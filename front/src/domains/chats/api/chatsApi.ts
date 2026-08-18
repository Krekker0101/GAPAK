import { httpClient } from '../../../shared/api/httpClient';
import type {
  Chat,
  ChatMember,
  Message,
  SendMessageRequest,
  TrustedDevice,
  RegisterTrustedDeviceRequest,
  PublishPreKeyRequest,
  PreKeyBundle,
  AcceptedResponse,
} from '../../../shared/api/backendContracts';
import type { HttpResponse } from '../../../shared/types';

export type { SendMessageRequest };

export interface CreateChatRequest {
  type: Chat['type'];
  title?: string;
  description?: string;
  avatarFileId?: string;
  encryptionProtocol?: 'SIGNAL' | 'OMEMO' | 'TRUSTED_CHAT' | 'NONE';
  trustedChat: boolean;
  messageTtlSeconds?: number;
  participantIds: string[];
  metadata?: Record<string, unknown>;
}

export const chatsApi = {
  list: (
    params: { type?: Chat['type']; limit?: number; offset?: number; unreadOnly?: boolean; pinnedOnly?: boolean } = {},
    signal?: AbortSignal,
  ) => httpClient.get<Chat[]>('/chats', { params, signal }),

  get: (chatId: string, signal?: AbortSignal) =>
    httpClient.get<Chat>(`/chats/${encodeURIComponent(chatId)}`, { signal }),

  update: (chatId: string, data: Partial<Pick<Chat, 'title' | 'description' | 'messageTtlSeconds'>>, idempotencyKey = crypto.randomUUID()) =>
    httpClient.patch<Chat>(`/chats/${encodeURIComponent(chatId)}`, data, { idempotencyKey }),

  remove: (chatId: string, idempotencyKey = crypto.randomUUID()) =>
    httpClient.delete<void>(`/chats/${encodeURIComponent(chatId)}`, { idempotencyKey }),

  create: (data: CreateChatRequest, idempotencyKey = crypto.randomUUID()) =>
    httpClient.post<Chat>('/chats', data, { idempotencyKey }),

  messages: (
    chatId: string,
    params: { cursor?: string; cursorId?: string; limit?: number; before?: boolean; withReplies?: boolean; withAttachments?: boolean } = {},
    signal?: AbortSignal,
  ) => httpClient.get<Message[]>(`/chats/${encodeURIComponent(chatId)}/messages`, { params, signal }),

  messagesPage: (
    chatId: string,
    params: { cursor?: string; cursorId?: string; limit?: number; before?: boolean; withReplies?: boolean; withAttachments?: boolean } = {},
    signal?: AbortSignal,
  ) => httpClient.get<HttpResponse<Message[]>>(`/chats/${encodeURIComponent(chatId)}/messages`, { params, signal, includeResponseMeta: true }),

  sendMessage: (chatId: string, data: SendMessageRequest) =>
    httpClient.post<Message>(`/chats/${encodeURIComponent(chatId)}/messages`, data, { idempotencyKey: data.clientMessageId }),

  getMessage: (messageId: string, signal?: AbortSignal) =>
    httpClient.get<Message>(`/chats/messages/${encodeURIComponent(messageId)}`, { signal }),

  editMessage: (
    messageId: string,
    data: Partial<Pick<SendMessageRequest, 'ciphertext' | 'nonce' | 'authenticationTag' | 'metadata' | 'attachments'>>,
    idempotencyKey = crypto.randomUUID(),
  ) => httpClient.patch<Message>(`/chats/messages/${encodeURIComponent(messageId)}`, data, { idempotencyKey }),

  deleteMessage: (messageId: string, deleteForEveryone = true, idempotencyKey = crypto.randomUUID()) =>
    httpClient.delete<void>(`/chats/messages/${encodeURIComponent(messageId)}`, {
      idempotencyKey,
      data: { deleteForEveryone },
    }),

  react: (messageId: string, reactionType: string, idempotencyKey = crypto.randomUUID()) =>
    httpClient.post<AcceptedResponse>(`/chats/messages/${encodeURIComponent(messageId)}/reactions`, { reactionType }, { idempotencyKey }),

  removeReaction: (messageId: string, reactionType: string, idempotencyKey = crypto.randomUUID()) =>
    httpClient.delete<void>(`/chats/messages/${encodeURIComponent(messageId)}/reactions`, {
      idempotencyKey,
      data: { reactionType },
    }),

  markAsRead: (messageId: string, idempotencyKey = crypto.randomUUID()) =>
    httpClient.post<AcceptedResponse>(`/chats/messages/${encodeURIComponent(messageId)}/read`, { messageId }, { idempotencyKey }),

  markAsDelivered: (messageId: string, idempotencyKey = crypto.randomUUID()) =>
    httpClient.post<AcceptedResponse>(`/chats/messages/${encodeURIComponent(messageId)}/delivered`, undefined, { idempotencyKey }),

  trustedDevices: (signal?: AbortSignal) => httpClient.get<TrustedDevice[]>('/chats/trusted-devices', { signal }),
  devices: (signal?: AbortSignal) => httpClient.get<TrustedDevice[]>('/chats/trusted-devices', { signal }),

  revokeDevice: (deviceId: string, idempotencyKey = crypto.randomUUID()) =>
    httpClient.delete<void>(`/chats/trusted-devices/${encodeURIComponent(deviceId)}`, { idempotencyKey }),

  registerTrustedDevice: (data: RegisterTrustedDeviceRequest, idempotencyKey = crypto.randomUUID()) =>
    httpClient.post<TrustedDevice>('/chats/trusted-devices', data, { idempotencyKey }),

  revokeTrustedDevice: (deviceId: string, idempotencyKey = crypto.randomUUID()) =>
    httpClient.delete<void>(`/chats/trusted-devices/${encodeURIComponent(deviceId)}`, { idempotencyKey }),

  publishPreKey: (deviceId: string, data: PublishPreKeyRequest, idempotencyKey = crypto.randomUUID()) =>
    httpClient.post<unknown>(`/chats/trusted-devices/${encodeURIComponent(deviceId)}/pre-keys`, data, { idempotencyKey }),

  preKeyBundle: (userId: string, signal?: AbortSignal) =>
    httpClient.get<PreKeyBundle>(`/chats/pre-key-bundles/${encodeURIComponent(userId)}`, { signal }),

  members: (chatId: string, params: { role?: string; limit?: number; offset?: number } = {}, signal?: AbortSignal) =>
    httpClient.get<ChatMember[]>(`/chats/${encodeURIComponent(chatId)}/members`, { params, signal }),

  typing: (chatId: string, status: 'TYPING' | 'STOPPED', idempotencyKey = crypto.randomUUID()) =>
    httpClient.post<void>(`/chats/${encodeURIComponent(chatId)}/typing`, { status }, { idempotencyKey }),

  pinned: (chatId: string, signal?: AbortSignal) =>
    httpClient.get<Array<{ id: string; chatId: string; messageId: string; pinnedById: string; pinnedAt: string }>>(`/chats/${encodeURIComponent(chatId)}/pinned`, { signal }),

  pin: (chatId: string, messageId: string, idempotencyKey = crypto.randomUUID()) =>
    httpClient.post<unknown>(`/chats/${encodeURIComponent(chatId)}/pinned`, { messageId }, { idempotencyKey }),

  unpin: (chatId: string, messageId: string, idempotencyKey = crypto.randomUUID()) =>
    httpClient.delete<void>(`/chats/${encodeURIComponent(chatId)}/pinned/${encodeURIComponent(messageId)}`, { idempotencyKey }),
};
