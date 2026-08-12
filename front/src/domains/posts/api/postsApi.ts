import { httpClient } from '../../../shared/api/httpClient';
import type {
  Comment,
  CreateCommentRequest as BackendCreateCommentRequest,
  CreatePostRequest as BackendCreatePostRequest,
  Post,
  UpdatePostRequest as BackendUpdatePostRequest,
} from '../../../shared/api/backendContracts';

export interface PostFeedParams {
  page?: number;
  limit?: number;
  contentType?: 'POST' | 'CLIP';
  cursor?: string;
}

export interface PostFeedPage {
  items: Post[];
  nextCursor: string | null;
  hasMore: boolean;
}

export type CreatePostRequest = BackendCreatePostRequest;
export type CreateCommentRequest = BackendCreateCommentRequest;

export const postsApi = {
  feed: async (params: PostFeedParams = {}, signal?: AbortSignal): Promise<PostFeedPage> => {
    const result = await httpClient.get<Post[]>('/posts/feed', {
      params,
      signal,
      includeResponseMeta: true,
    });
    const transport = result as unknown as { data: Post[]; headers: Headers };
    const nextCursor = transport.headers.get('X-Next-Cursor');
    return {
      items: transport.data,
      nextCursor: nextCursor || null,
      hasMore: Boolean(nextCursor),
    };
  },

  clips: async (params: PostFeedParams = {}, signal?: AbortSignal): Promise<PostFeedPage> => {
    const result = await httpClient.get<Post[]>('/posts/clips', {
      params,
      signal,
      includeResponseMeta: true,
    });
    const transport = result as unknown as { data: Post[]; headers: Headers };
    const nextCursor = transport.headers.get('X-Next-Cursor');
    return { items: transport.data, nextCursor: nextCursor || null, hasMore: Boolean(nextCursor) };
  },

  get: (postId: string, signal?: AbortSignal) =>
    httpClient.get<Post>(`/posts/${encodeURIComponent(postId)}`, { signal }),

  comments: (postId: string, params: { page?: number; limit?: number; sortBy?: 'recent' | 'top' } = {}, signal?: AbortSignal) =>
    httpClient.get<Comment[]>(`/posts/${encodeURIComponent(postId)}/comments`, { params, signal }),

  likes: (postId: string, signal?: AbortSignal) =>
    httpClient.get<{ userId: string; username: string }[]>(`/posts/${encodeURIComponent(postId)}/likes`, { signal }),

  create: (payload: CreatePostRequest, idempotencyKey: string) =>
    httpClient.post<Post>('/posts', payload, { idempotencyKey }),

  update: (postId: string, payload: BackendUpdatePostRequest, idempotencyKey: string) =>
    httpClient.patch<Post>(`/posts/${encodeURIComponent(postId)}`, payload, { idempotencyKey }),

  remove: (postId: string, idempotencyKey: string) =>
    httpClient.delete<void>(`/posts/${encodeURIComponent(postId)}`, { idempotencyKey }),

  like: (postId: string, idempotencyKey: string) =>
    httpClient.post<{ accepted: boolean }>(`/posts/${encodeURIComponent(postId)}/like`, undefined, { idempotencyKey }),

  unlike: (postId: string, idempotencyKey: string) =>
    httpClient.delete<void>(`/posts/${encodeURIComponent(postId)}/like`, { idempotencyKey }),

  comment: (postId: string, payload: CreateCommentRequest, idempotencyKey: string) =>
    httpClient.post<Comment>(`/posts/${encodeURIComponent(postId)}/comments`, payload, { idempotencyKey }),

  updateComment: (commentId: string, content: string, idempotencyKey: string) =>
    httpClient.patch<Comment>(`/posts/comments/${encodeURIComponent(commentId)}`, { content }, { idempotencyKey }),

  deleteComment: (commentId: string, idempotencyKey: string) =>
    httpClient.delete<void>(`/posts/comments/${encodeURIComponent(commentId)}`, { idempotencyKey }),

  likeComment: (commentId: string, idempotencyKey: string) =>
    httpClient.post<{ accepted: boolean }>(`/posts/comments/${encodeURIComponent(commentId)}/like`, undefined, { idempotencyKey }),

  unlikeComment: (commentId: string, idempotencyKey: string) =>
    httpClient.delete<void>(`/posts/comments/${encodeURIComponent(commentId)}/like`, { idempotencyKey }),
};
