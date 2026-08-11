import { httpClient } from '../../../shared/api/httpClient';
import { LiveChatMessage, LiveStream } from '../../../shared/types/live';
import { PlaybackGrant } from '../../../shared/types/media';

export interface LivePage { items: LiveStream[]; nextCursor?: string | null; hasMore: boolean; }
export interface LiveChatPage { items: LiveChatMessage[]; nextCursor?: string | null; hasMore: boolean; }

export const liveApi = {
  list: (params?: { cursor?: string; limit?: number }, signal?: AbortSignal) =>
    httpClient.get<LivePage>('/api/live-streams', { params, signal }),
  get: (streamId: string, signal?: AbortSignal) =>
    httpClient.get<LiveStream>(`/api/live-streams/${encodeURIComponent(streamId)}`, { signal }),
  chat: (streamId: string, params?: { cursor?: string; limit?: number }, signal?: AbortSignal) =>
    httpClient.get<LiveChatPage>(`/api/live-streams/${encodeURIComponent(streamId)}/chat`, { params, signal }),
  requestPlaybackGrant: async (_streamId: string, _signal?: AbortSignal): Promise<{ grant: PlaybackGrant }> => {
    throw new Error('Live playback authorization is not exposed by the current backend contract.');
  },
};
