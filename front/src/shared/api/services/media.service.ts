import { apiClient } from "@/shared/api/client";
import type {
  CompleteUploadSessionRequest,
  CreateUploadSessionRequest,
  MediaAssetResponse,
  PlaybackGrantResponse,
  UploadSessionResponse,
} from "@/shared/types/media";

export const mediaService = {
  createUploadSession(payload: CreateUploadSessionRequest) {
    return apiClient<UploadSessionResponse>({
      path: "/media/upload-sessions",
      method: "POST",
      body: payload,
    });
  },
  completeUploadSession(sessionId: string, payload: CompleteUploadSessionRequest) {
    return apiClient<UploadSessionResponse>({
      path: `/media/upload-sessions/${sessionId}/complete`,
      method: "POST",
      body: payload,
    });
  },
  getAsset(mediaId: string) {
    return apiClient<MediaAssetResponse>({
      path: `/media/assets/${mediaId}`,
    });
  },
  createPlaybackGrant(mediaId: string, reason: string) {
    return apiClient<PlaybackGrantResponse>({
      path: `/media/assets/${mediaId}/playback-grants`,
      method: "POST",
      body: {
        reason,
      },
    });
  },
  async getPlaybackUrl(mediaId: string, reason: string) {
    const grant = await this.createPlaybackGrant(mediaId, reason);
    return grant.request.url;
  },
  async uploadFile(file: File, purpose: CreateUploadSessionRequest["purpose"]) {
    const session = await this.createUploadSession({
      purpose,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      multipart: false,
    });

    const grant = session.partGrants?.[0];
    if (!grant) {
      throw new Error("Upload session is missing the first signed upload grant");
    }

    const uploadResponse = await fetch(grant.request.url, {
      method: grant.request.method,
      headers: {
        ...grant.request.headers,
        "Content-Type": file.type || grant.request.headers["Content-Type"] || "application/octet-stream",
      },
      body: file,
      credentials: "include",
      cache: "no-store",
    });

    if (!uploadResponse.ok) {
      throw new Error("File upload request failed");
    }

    const etag =
      uploadResponse.headers.get("etag") ||
      uploadResponse.headers.get("ETag") ||
      `uploaded-${file.size}-${Date.now()}`;

    const completed = await this.completeUploadSession(session.id, {
      parts: [
        {
          partNumber: grant.partNumber,
          etag,
          sizeBytes: file.size,
        },
      ],
    });

    return {
      session: completed,
      mediaFileId: completed.mediaFileId,
    };
  },
};
