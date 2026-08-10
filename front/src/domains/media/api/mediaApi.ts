import { httpClient } from '../../../shared/api/httpClient';
import {
  MediaAlbumPage, MediaPage, MediaUsageContext, PlaybackGrantResponse,
  UploadCompleteResponse, UploadInitResponse,
} from '../../../shared/types/media';

export interface MediaListParams {
  cursor?: string;
  limit?: number;
  search?: string;
  kind?: string;
  privacy?: string;
  albumId?: string;
  sort?: 'newest' | 'oldest' | 'name' | 'size';
}

export const mediaApi = {
  list: (params: MediaListParams, signal?: AbortSignal) =>
    httpClient.get<MediaPage>('/api/media', { params, signal }),

  albums: (params?: { cursor?: string; limit?: number; search?: string }, signal?: AbortSignal) =>
    httpClient.get<MediaAlbumPage>('/api/media/albums', { params, signal }),

  initializeUpload: (input: {
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    checksumSha256: string;
    context: MediaUsageContext;
    privacy?: string;
    albumId?: string;
  }, idempotencyKey: string, signal?: AbortSignal) =>
    httpClient.post<UploadInitResponse>('/api/media/uploads', input, { idempotencyKey, signal }),

  getUpload: (uploadId: string, signal?: AbortSignal) =>
    httpClient.get<UploadInitResponse>(`/api/media/uploads/${encodeURIComponent(uploadId)}`, { signal }),

  completeUpload: (uploadId: string, input: { parts?: Array<{ partNumber: number; etag: string }> }, idempotencyKey: string, signal?: AbortSignal) =>
    httpClient.post<UploadCompleteResponse>(`/api/media/uploads/${encodeURIComponent(uploadId)}/complete`, input, { idempotencyKey, signal }),

  cancelUpload: (uploadId: string, idempotencyKey: string) =>
    httpClient.post<void>(`/api/media/uploads/${encodeURIComponent(uploadId)}/cancel`, undefined, { idempotencyKey }),

  requestPlaybackGrant: (mediaId: string, context: MediaUsageContext, signal?: AbortSignal) =>
    httpClient.post<PlaybackGrantResponse>('/api/media/playback-grants', { mediaId, context }, {
      idempotencyKey: crypto.randomUUID(), signal,
    }),
};
