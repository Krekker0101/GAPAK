import { httpClient } from '../../../shared/api/httpClient';
import { Story, UserStoryGroup } from '../../../shared/types/social';

export interface StoryPage { items: UserStoryGroup[]; nextCursor?: string | null; hasMore: boolean; }

export const storiesApi = {
  feed: (params?: { cursor?: string; limit?: number }, signal?: AbortSignal) =>
    httpClient.get<StoryPage>('/api/stories', { params, signal }),
  get: (storyId: string, signal?: AbortSignal) =>
    httpClient.get<Story>(`/api/stories/${encodeURIComponent(storyId)}`, { signal }),
  markViewed: (storyId: string, idempotencyKey: string) =>
    httpClient.post<void>(`/api/stories/${encodeURIComponent(storyId)}/view`, undefined, { idempotencyKey }),
  react: (storyId: string, emoji: string, idempotencyKey: string) =>
    httpClient.post<void>(`/api/stories/${encodeURIComponent(storyId)}/reactions`, { emoji }, { idempotencyKey }),
  reply: (storyId: string, text: string, idempotencyKey: string) =>
    httpClient.post<void>(`/api/stories/${encodeURIComponent(storyId)}/replies`, { text }, { idempotencyKey }),
};
