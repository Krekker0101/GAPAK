/**
 * Client-side Decrypted Message Cache & Keyset Pagination Manager
 * GAPAK Realtime E2EE Messenger
 *
 * Provides fast keyset pagination (before/after cursors), draft storage,
 * and optimistic message reconciliation without blocking the React UI thread.
 */

import {
  ChatMessage,
  PaginatedMessagesResponse,
  KeysetPaginationCursor,
} from '../../../shared/types';

class MessageCacheManagerService {
  private chatMessagesStore: Map<string, ChatMessage[]> = new Map();
  private draftStore: Map<string, string> = new Map();

  /**
   * Initializes or seeds chat messages
   */
  public setChatMessages(chatId: string, messages: ChatMessage[]) {
    // Sort chronologically ascending
    const sorted = [...messages].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    this.chatMessagesStore.set(chatId, sorted);
  }

  /**
   * Adds or updates a decrypted message in cache
   */
  public addOrUpdateMessage(chatId: string, message: ChatMessage) {
    const list = this.chatMessagesStore.get(chatId) || [];
    const index = list.findIndex((m) => m.id === message.id);

    if (index !== -1) {
      list[index] = { ...list[index], ...message };
    } else {
      list.push(message);
      list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }

    this.chatMessagesStore.set(chatId, list);
  }

  /**
   * Performs Keyset Pagination (before/after cursors)
   */
  public getPaginatedMessages(
    chatId: string,
    params: KeysetPaginationCursor
  ): PaginatedMessagesResponse {
    const list = this.chatMessagesStore.get(chatId) || [];
    const limit = params.limit || 20;

    if (list.length === 0) {
      return { messages: [], hasMoreBefore: false, hasMoreAfter: false };
    }

    if (!params.cursor) {
      // Default: fetch the latest `limit` messages
      const sliced = list.slice(Math.max(0, list.length - limit));
      const hasMoreBefore = list.length > limit;
      return {
        messages: sliced,
        hasMoreBefore,
        hasMoreAfter: false,
        nextCursorBefore: sliced.length > 0 ? sliced[0].id : undefined,
      };
    }

    const cursorIndex = list.findIndex((m) => m.id === params.cursor);
    if (cursorIndex === -1) {
      // Fallback
      const sliced = list.slice(Math.max(0, list.length - limit));
      return { messages: sliced, hasMoreBefore: false, hasMoreAfter: false };
    }

    if (params.direction === 'before') {
      const startIndex = Math.max(0, cursorIndex - limit);
      const sliced = list.slice(startIndex, cursorIndex);
      return {
        messages: sliced,
        hasMoreBefore: startIndex > 0,
        hasMoreAfter: true,
        nextCursorBefore: sliced.length > 0 ? sliced[0].id : undefined,
        nextCursorAfter: list[cursorIndex]?.id,
      };
    } else {
      const endIndex = Math.min(list.length, cursorIndex + 1 + limit);
      const sliced = list.slice(cursorIndex + 1, endIndex);
      return {
        messages: sliced,
        hasMoreBefore: true,
        hasMoreAfter: endIndex < list.length,
        nextCursorBefore: list[cursorIndex]?.id,
        nextCursorAfter: sliced.length > 0 ? sliced[sliced.length - 1].id : undefined,
      };
    }
  }

  /**
   * Gets all messages for a chat
   */
  public getAllMessages(chatId: string): ChatMessage[] {
    return this.chatMessagesStore.get(chatId) || [];
  }

  /**
   * Draft storage per chat
   */
  public setDraft(chatId: string, text: string) {
    if (!text.trim()) this.draftStore.delete(chatId);
    else this.draftStore.set(chatId, text);
  }

  public getDraft(chatId: string): string {
    return this.draftStore.get(chatId) || '';
  }
}

export const messageCacheManager = new MessageCacheManagerService();
