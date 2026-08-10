import { httpClient } from '../../../shared/api/httpClient';
import { LiveChatMessage, LiveStream } from '../../../shared/types/live';
import { PlaybackGrant } from '../../../shared/types/media';

export interface LivePage { items: LiveStream[]; nextCursor?: string | null; hasMore: boolean; }
export interface LiveChatPage { items: LiveChatMessage[]; nextCursor?: string | null; hasMore: boolean; }

export const liveApi = {
  list: (params?: { cursor?: string; limit?: number }, signal?: AbortSignal) =>
    httpClient.get<LivePage>('/api/live', { params, signal }),
  get: (streamId: string, signal?: AbortSignal) =>
    httpClient.get<LiveStream>(`/api/live/${encodeURIComponent(streamId)}`, { signal }),
  chat: (streamId: string, params?: { cursor?: string; limit?: number }, signal?: AbortSignal) =>
    httpClient.get<LiveChatPage>(`/api/live/${encodeURIComponent(streamId)}/chat`, { params, signal }),
  requestPlaybackGrant: (streamId: string, signal?: AbortSignal) =>
    httpClient.post<{ grant: PlaybackGrant }>(`/api/live/${encodeURIComponent(streamId)}/playback-grant`, undefined, { idempotencyKey: crypto.randomUUID(), signal }),
};
