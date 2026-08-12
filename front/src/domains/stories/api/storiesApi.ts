import { httpClient } from '../../../shared/api/httpClient';
import type { AcceptedResponse, CreateStoryRequest, Story, StoryViewer } from '../../../shared/api/backendContracts';

export type StoryReactionType = 'LIKE' | 'FIRE' | 'SUPPORT';

export const normalizeStoryReaction = (reaction: string): StoryReactionType => {
  if (reaction === 'LIKE' || reaction === 'FIRE' || reaction === 'SUPPORT') return reaction;
  throw new Error(`Unsupported story reaction: ${reaction}`);
};

export const storiesApi = {
  feed: (params?: { page?: number; limit?: number }, signal?: AbortSignal) =>
    httpClient.get<Story[]>('/stories/feed', { params, signal }),
  get: (storyId: string, signal?: AbortSignal) =>
    httpClient.get<Story>(`/stories/${encodeURIComponent(storyId)}`, { signal }),
  viewers: (storyId: string, signal?: AbortSignal) =>
    httpClient.get<StoryViewer[]>(`/stories/${encodeURIComponent(storyId)}/viewers`, { signal }),
  /** GET /stories/:storyId records the view server-side for non-owners. */
  markViewed: (storyId: string, signal?: AbortSignal) => storiesApi.get(storyId, signal),
  react: (storyId: string, reactionType: StoryReactionType, idempotencyKey: string, signal?: AbortSignal) =>
    httpClient.post<AcceptedResponse>(`/stories/${encodeURIComponent(storyId)}/reactions`, { reactionType }, { idempotencyKey, signal }),
  highlight: (storyId: string, title: string, idempotencyKey: string, signal?: AbortSignal) =>
    httpClient.post<AcceptedResponse>(`/stories/${encodeURIComponent(storyId)}/highlight`, { title }, { idempotencyKey, signal }),
  create: (input: CreateStoryRequest, idempotencyKey: string, signal?: AbortSignal) =>
    httpClient.post<Story>('/stories', input, { idempotencyKey, signal }),
  delete: (storyId: string, idempotencyKey: string, signal?: AbortSignal) =>
    httpClient.delete<AcceptedResponse>(`/stories/${encodeURIComponent(storyId)}`, { idempotencyKey, signal }),
};
