import { apiClient } from "@/shared/api/client";
import type { ListQuery } from "@/shared/types/api";
import type {
  ChatResponse,
  ChatEventResponse,
  CreateDirectChatRequest,
  MessageResponse,
  SendMessageRequest,
} from "@/shared/types/chat";

export const chatService = {
  listChats() {
    return apiClient<ChatResponse[]>({
      path: "/chats",
    });
  },
  createDirect(payload: CreateDirectChatRequest) {
    return apiClient<ChatResponse>({
      path: "/chats/direct",
      method: "POST",
      body: payload,
    });
  },
  getMessages(chatId: string, query?: ListQuery) {
    return apiClient<MessageResponse[]>({
      path: `/chats/${chatId}/messages`,
      query,
    });
  },
  getEvents(chatId: string, query?: { after?: number; limit?: number }) {
    return apiClient<ChatEventResponse[]>({
      path: `/chats/${chatId}/events`,
      query,
    });
  },
  sendMessage(chatId: string, payload: SendMessageRequest) {
    return apiClient<MessageResponse>({
      path: `/chats/${chatId}/messages`,
      method: "POST",
      body: payload,
    });
  },
};
