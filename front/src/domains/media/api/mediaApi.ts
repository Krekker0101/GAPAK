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
  list: async (_params: MediaListParams, _signal?: AbortSignal): Promise<MediaPage> => ({ items: [], hasMore: false }),

  albums: async (_params?: { cursor?: string; limit?: number; search?: string }, _signal?: AbortSignal): Promise<MediaAlbumPage> => ({ items: [], hasMore: false }),

  initializeUpload: (input: {
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    checksumSha256: string;
    context: MediaUsageContext;
    privacy?: string;
    albumId?: string;
  }, idempotencyKey: string, signal?: AbortSignal) =>
    (async () => {
      const purpose = input.context;
      const response = await httpClient.post<{ id: string; mediaFileId: string; partSizeBytes: number; totalParts: number; expiresAt: string; partGrants?: Array<{ partNumber: number; request: { url: string; headers: Record<string,string> } }> }>('/api/media/upload-sessions', {
        purpose, fileName: input.fileName, mimeType: input.mimeType, sizeBytes: input.sizeBytes, checksumSha256: input.checksumSha256, multipart: true,
      }, { idempotencyKey, signal });
      return {
        uploadId: response.id, mode: response.totalParts > 1 ? 'multipart' : 'single', chunkSizeBytes: response.partSizeBytes, expiresAt: response.expiresAt,
        mediaId: response.mediaFileId,
        parts: (response.partGrants ?? []).map((part) => ({ partNumber: part.partNumber, url: part.request.url, headers: part.request.headers })),
      } as UploadInitResponse;
    })(),

  requestUploadPart: async (uploadId: string, partNumber: number, signal?: AbortSignal) => {
    const response = await httpClient.post<{ partNumber: number; request: { url: string; headers: Record<string,string> } }>(`/api/media/upload-sessions/${encodeURIComponent(uploadId)}/parts`, { partNumber }, { idempotencyKey: crypto.randomUUID(), signal });
    return { partNumber: response.partNumber, url: response.request.url, headers: response.request.headers };
  },

  getUpload: (uploadId: string, signal?: AbortSignal) =>
    httpClient.get<UploadInitResponse>(`/api/media/upload-sessions/${encodeURIComponent(uploadId)}`, { signal }) as Promise<UploadInitResponse>,

  completeUpload: (uploadId: string, input: { parts?: Array<{ partNumber: number; etag: string; sizeBytes: number }> }, idempotencyKey: string, signal?: AbortSignal) =>
    (async () => { const response = await httpClient.post<{ id: string; mediaFileId: string; status: string; fileName: string; mimeType: string; sizeBytes: number }>(`/api/media/upload-sessions/${encodeURIComponent(uploadId)}/complete`, { parts: (input.parts ?? []).map((p) => ({ partNumber: p.partNumber, etag: p.etag, sizeBytes: p.sizeBytes })) }, { idempotencyKey, signal }); return { media: { id: response.mediaFileId, ownerId: '', fileName: response.fileName, mimeType: response.mimeType, sizeBytes: response.sizeBytes, kind: 'document', privacy: 'PRIVATE', encrypted: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } } as UploadCompleteResponse; })(),

  cancelUpload: (uploadId: string, idempotencyKey: string) =>
    httpClient.post<void>(`/api/media/upload-sessions/${encodeURIComponent(uploadId)}/abort`, { reason: 'client_cancelled' }, { idempotencyKey }),

  requestPlaybackGrant: (mediaId: string, context: MediaUsageContext, signal?: AbortSignal) =>
    (async () => {
      const response = await httpClient.post<any>(`/api/media/assets/${encodeURIComponent(mediaId)}/playback-grants`, { reason: context, maxViews: 10 }, { idempotencyKey: crypto.randomUUID(), signal });
      const url = response?.request?.url;
      if (!url) throw new Error('Backend did not provide a playback URL.');
      return { grant: { mediaId, grantToken: response.id, expiresAt: new Date(response.expiresAt).getTime(), streamType: 'hls', variants: [], masterManifestUrl: url } } as PlaybackGrantResponse;
    })(),
};
