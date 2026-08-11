import { httpClient } from '../../../shared/api/httpClient';
import { Chat, ChatMessage, ChatType, PaginatedMessagesResponse, TrustedDevice } from '../../../shared/types';

export interface ChatListResponse { chats: Chat[]; nextCursor?: string; hasMore?: boolean }
export interface CreateChatRequest { type: ChatType; title?: string; description?: string; memberIds: string[] }
export interface SendMessageRequest { clientMessageId: string; contentType: string; envelope: any; replyToMessageId?: string; attachments?: unknown[] }

export const chatsApi = {
  list: (signal?: AbortSignal) => httpClient.request<ChatListResponse | Chat[]>({ url: '/api/chats', signal }),
  messages: (chatId: string, params: { before?: string; after?: string; limit?: number }, signal?: AbortSignal) =>
    httpClient.request<PaginatedMessagesResponse>({ url: `/api/chats/${encodeURIComponent(chatId)}/messages`, params, signal }),
  create: (data: CreateChatRequest) => httpClient.request<Chat>({ url: '/api/chats', method: 'POST', data, idempotencyKey: crypto.randomUUID() }),
  sendMessage: (chatId: string, data: SendMessageRequest) => {
    const envelope = data.envelope as any;
    const keyEnvelopes = Object.values(envelope.keyEnvelopes ?? {}).map((raw: any) => { const item = typeof raw === 'string' ? JSON.parse(raw) : raw; return { recipientUserId: item.recipientUserId, recipientDeviceId: item.recipientDeviceId, keyId: item.identityKeyId || envelope.senderKeyId, algorithm: 'AES-GCM', encryptedKey: item.wrappedKey, nonce: item.wrappedIv, keyVersion: 1 }; });
    return httpClient.request<ChatMessage>({ url: `/api/chats/${encodeURIComponent(chatId)}/messages`, method: 'POST', data: { clientMessageId: data.clientMessageId, type: String(data.contentType).toUpperCase(), ciphertext: envelope.ciphertext, nonce: envelope.nonce, senderKeyId: envelope.senderKeyId, encryptionProtocol: 'SIGNAL', encryptionAlgorithm: 'AES-GCM', associatedData: '', ratchetCounter: envelope.ratchetCounter ?? 0, authenticationTag: envelope.authenticationTag, replyToMessageId: data.replyToMessageId, keyEnvelopes, content: '', attachments: [] }, idempotencyKey: data.clientMessageId });
  },
  editMessage: async (_chatId: string, _messageId: string, _content: unknown): Promise<ChatMessage> => { throw new Error('Encrypted message editing requires a server-side encrypted edit envelope and is not exposed by the current client contract.'); },
  deleteMessage: (chatId: string, messageId: string) => httpClient.request<void>({ url: `/api/chats/messages/${encodeURIComponent(messageId)}`, method: 'DELETE', data: { deleteForEveryone: false }, idempotencyKey: crypto.randomUUID() }),
  react: (chatId: string, messageId: string, emoji: string) => httpClient.request<void>({ url: `/api/chats/messages/${encodeURIComponent(messageId)}/reactions`, method: 'POST', data: { reactionType: emoji.toUpperCase() }, idempotencyKey: crypto.randomUUID() }),
  devices: (signal?: AbortSignal) => httpClient.request<TrustedDevice[]>({ url: '/api/chats/trusted-devices', signal }),
  revokeDevice: (deviceId: string) => httpClient.request<void>({ url: `/api/chats/trusted-devices/${encodeURIComponent(deviceId)}`, method: 'DELETE' }),
  verifyDevice: async (_deviceId: string) => undefined,
};
