import { httpClient } from '../../../shared/api/httpClient';
import type { AcceptedResponse, LiveChatMessage, LiveEvent, LiveStream } from '../../../shared/api/backendContracts';

export const liveApi = {
  list: (params?: { page?: number; limit?: number }, signal?: AbortSignal) => httpClient.get<LiveStream[]>('/live-streams', { params, signal }),
  get: (streamId: string, signal?: AbortSignal) => httpClient.get<LiveStream>(`/live-streams/${encodeURIComponent(streamId)}`, { signal }),
  events: (streamId: string, params?: { after?: number; limit?: number }, signal?: AbortSignal) => httpClient.get<LiveEvent[]>(`/live-streams/${encodeURIComponent(streamId)}/events`, { params, signal }),
  chat: (streamId: string, params?: { page?: number; limit?: number }, signal?: AbortSignal) => httpClient.get<LiveChatMessage[]>(`/live-streams/${encodeURIComponent(streamId)}/chat`, { params, signal }),
  create: (payload: { trustRoomId?: string; title: string; description?: string; visibility: string; scheduledFor?: string; allowReplay: boolean }, idempotencyKey: string) => httpClient.post<LiveStream>('/live-streams', payload, { idempotencyKey }),
  start: (streamId: string, idempotencyKey: string) => httpClient.post<AcceptedResponse>(`/live-streams/${encodeURIComponent(streamId)}/start`, undefined, { idempotencyKey }),
  end: (streamId: string, idempotencyKey: string) => httpClient.post<AcceptedResponse>(`/live-streams/${encodeURIComponent(streamId)}/end`, undefined, { idempotencyKey }),
  join: (streamId: string, payload: { role: 'VIEWER' | 'GUEST'; isGhostMode: false }, idempotencyKey: string) => httpClient.post<AcceptedResponse>(`/live-streams/${encodeURIComponent(streamId)}/join`, payload, { idempotencyKey }),
  postChat: (streamId: string, body: string, idempotencyKey: string) => httpClient.post<LiveChatMessage>(`/live-streams/${encodeURIComponent(streamId)}/chat`, { body }, { idempotencyKey }),
};
