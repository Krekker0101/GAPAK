import { httpClient } from '../../../shared/api/httpClient';
import { Story, UserStoryGroup } from '../../../shared/types/social';

export interface StoryPage { items: UserStoryGroup[]; nextCursor?: string | null; hasMore: boolean; }

export const storiesApi = {
  feed: (params?: { cursor?: string; limit?: number }, signal?: AbortSignal) =>
    httpClient.get<StoryPage>('/api/stories/feed', { params, signal }),
  get: (storyId: string, signal?: AbortSignal) =>
    httpClient.get<Story>(`/api/stories/${encodeURIComponent(storyId)}`, { signal }),
  markViewed: async (_storyId: string, _idempotencyKey: string) => undefined,
  react: (storyId: string, emoji: string, idempotencyKey: string) =>
    httpClient.post<void>(`/api/stories/${encodeURIComponent(storyId)}/reactions`, { reactionType: emoji.toUpperCase() === 'LIKE' || emoji.toUpperCase() === 'FIRE' || emoji.toUpperCase() === 'SUPPORT' ? emoji.toUpperCase() : 'LIKE' }, { idempotencyKey }),
  reply: async (_storyId: string, _text: string, _idempotencyKey: string) => undefined,
};
