import { httpClient } from '../../../shared/api/httpClient';
import { Comment, Post } from '../../../shared/types/social';
export interface CursorPage<T> { items: T[]; nextCursor?: string | null; hasMore?: boolean; }
export const postsApi = {
  feed: (params?: { cursor?: string; limit?: number; contentType?: string; privacy?: string }, signal?: AbortSignal) => httpClient.get<CursorPage<Post>>('/api/posts/feed', { params, signal }),
  get: (postId: string, signal?: AbortSignal) => httpClient.get<Post>(`/api/posts/${encodeURIComponent(postId)}`, { signal }),
  create: (payload: unknown, idempotencyKey: string) => httpClient.post<Post>('/api/posts', payload, { idempotencyKey }),
  like: (postId: string, idempotencyKey: string) => httpClient.post<void>(`/api/posts/${encodeURIComponent(postId)}/like`, undefined, { idempotencyKey }),
  unlike: (postId: string) => httpClient.delete<void>(`/api/posts/${encodeURIComponent(postId)}/like`),
  comment: (postId: string, payload: { body: string; parentId?: string }, idempotencyKey: string) => httpClient.post<Comment>(`/api/posts/${encodeURIComponent(postId)}/comments`, payload, { idempotencyKey }),
};
