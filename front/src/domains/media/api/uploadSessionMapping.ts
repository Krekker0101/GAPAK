import type { UploadSession } from '../../../shared/api/backendContracts';
import type { UploadInitResponse } from '../../../shared/types/media';

export function mapUploadSession(response: UploadSession): UploadInitResponse {
  if (!response.id || !Number.isSafeInteger(response.totalParts) || response.totalParts < 1
    || !Number.isSafeInteger(response.partSizeBytes) || response.partSizeBytes < 1) {
    throw new Error('Upload contract error: invalid upload session.');
  }
  return {
    uploadId: response.id,
    // This API always uses numbered part grants and a completion manifest,
    // including files that fit in ONE part. It never returns uploadUrl.
    mode: 'multipart',
    chunkSizeBytes: response.partSizeBytes,
    totalParts: response.totalParts,
    parts: response.partGrants?.map(g => ({ partNumber: g.partNumber, url: g.request.url, headers: g.request.headers })),
    expiresAt: response.expiresAt,
    mediaId: response.mediaFileId,
  };
}
