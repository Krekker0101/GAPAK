import { httpClient } from '../../../shared/api/httpClient';
import type { MediaAsset as BackendMediaAsset, PlaybackGrant as BackendPlaybackGrant, UploadPartGrant, UploadSession as BackendUploadSession } from '../../../shared/api/backendContracts';
import type { MediaUsageContext, UploadInitResponse } from '../../../shared/types/media';

const mapSession = (response: BackendUploadSession): UploadInitResponse => ({
  uploadId: response.id,
  mode: response.totalParts > 1 ? 'multipart' : 'single',
  chunkSizeBytes: response.partSizeBytes,
  totalParts: response.totalParts,
  parts: response.partGrants?.map(g => ({ partNumber: g.partNumber, url: g.request.url, headers: g.request.headers })),
  expiresAt: response.expiresAt,
  mediaId: response.mediaFileId,
});

export const mediaApi = {
  initializeUpload: async (input: { fileName: string; mimeType: string; sizeBytes: number; checksumSha256?: string; context: MediaUsageContext; multipart: boolean; partSizeBytes?: number }, idempotencyKey: string, signal?: AbortSignal): Promise<UploadInitResponse> => {
    const response = await httpClient.post<BackendUploadSession>('/media/upload-sessions', {
      purpose: input.context, fileName: input.fileName, mimeType: input.mimeType, sizeBytes: input.sizeBytes,
      ...(input.checksumSha256 ? { checksumSha256: input.checksumSha256 } : {}), multipart: input.multipart,
      ...(input.partSizeBytes ? { partSizeBytes: input.partSizeBytes } : {}),
    }, { idempotencyKey, signal });
    return mapSession(response);
  },
  getUpload: async (uploadId: string, signal?: AbortSignal): Promise<UploadInitResponse> => {
    const response = await httpClient.get<BackendUploadSession>(`/media/upload-sessions/${encodeURIComponent(uploadId)}`, { signal });
    return mapSession(response);
  },
  requestUploadPart: (uploadId: string, partNumber: number, idempotencyKey: string, signal?: AbortSignal) =>
    httpClient.post<UploadPartGrant>(`/media/upload-sessions/${encodeURIComponent(uploadId)}/parts`, { partNumber }, { idempotencyKey, signal }),
  completeUpload: (uploadId: string, parts: Array<{ partNumber: number; etag: string; sizeBytes: number }>, idempotencyKey: string, signal?: AbortSignal) =>
    httpClient.post<BackendUploadSession>(`/media/upload-sessions/${encodeURIComponent(uploadId)}/complete`, { parts }, { idempotencyKey, signal }),
  cancelUpload: (uploadId: string, reason: string, idempotencyKey: string, signal?: AbortSignal) =>
    httpClient.post<{ accepted: boolean }>(`/media/upload-sessions/${encodeURIComponent(uploadId)}/abort`, { reason }, { idempotencyKey, signal }),
  getAsset: (mediaId: string, signal?: AbortSignal) => httpClient.get<BackendMediaAsset>(`/media/assets/${encodeURIComponent(mediaId)}`, { signal }),
  requestPlaybackGrant: (mediaId: string, context: MediaUsageContext, signal?: AbortSignal) =>
    httpClient.post<BackendPlaybackGrant>(`/media/assets/${encodeURIComponent(mediaId)}/playback-grants`, { reason: context }, { signal }),
};
