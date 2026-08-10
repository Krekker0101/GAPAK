import { httpClient } from '../../../shared/api/httpClient';
import { Chat, ChatMessage, ChatType, PaginatedMessagesResponse, TrustedDevice } from '../../../shared/types';

export interface ChatListResponse { chats: Chat[]; nextCursor?: string; hasMore?: boolean }
export interface CreateChatRequest { type: ChatType; title?: string; description?: string; memberIds: string[] }
export interface SendMessageRequest { clientMessageId: string; contentType: string; envelope: unknown; replyToMessageId?: string; attachments?: unknown[] }

export const chatsApi = {
  list: (signal?: AbortSignal) => httpClient.request<ChatListResponse | Chat[]>({ url: '/api/chats', signal }),
  messages: (chatId: string, params: { before?: string; after?: string; limit?: number }, signal?: AbortSignal) =>
    httpClient.request<PaginatedMessagesResponse>({ url: `/api/chats/${encodeURIComponent(chatId)}/messages`, params, signal }),
  create: (data: CreateChatRequest) => httpClient.request<Chat>({ url: '/api/chats', method: 'POST', data, idempotencyKey: crypto.randomUUID() }),
  sendMessage: (chatId: string, data: SendMessageRequest) => httpClient.request<ChatMessage>({ url: `/api/chats/${encodeURIComponent(chatId)}/messages`, method: 'POST', data, idempotencyKey: data.clientMessageId }),
  editMessage: (chatId: string, messageId: string, content: unknown) => httpClient.request<ChatMessage>({ url: `/api/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}`, method: 'PATCH', data: { content }, idempotencyKey: crypto.randomUUID() }),
  deleteMessage: (chatId: string, messageId: string) => httpClient.request<void>({ url: `/api/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}`, method: 'DELETE', idempotencyKey: crypto.randomUUID() }),
  react: (chatId: string, messageId: string, emoji: string) => httpClient.request<void>({ url: `/api/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}/reactions`, method: 'POST', data: { emoji }, idempotencyKey: crypto.randomUUID() }),
  devices: (signal?: AbortSignal) => httpClient.request<TrustedDevice[]>({ url: '/api/security/devices', signal }),
  revokeDevice: (deviceId: string) => httpClient.request<void>({ url: `/api/security/devices/${encodeURIComponent(deviceId)}/revoke`, method: 'POST', idempotencyKey: crypto.randomUUID() }),
  verifyDevice: (deviceId: string) => httpClient.request<void>({ url: `/api/security/devices/${encodeURIComponent(deviceId)}/verify`, method: 'POST', idempotencyKey: crypto.randomUUID() }),
};
