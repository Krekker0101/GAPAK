/**
 * GAPAK Media domain contracts.
 *
 * Security rule: media URLs are server-issued. The client never invents
 * public CDN URLs or playback grants.
 */

export type MediaUsageContext =
  | 'POST_ATTACHMENT'
  | 'CHAT_ATTACHMENT'
  | 'CLIP'
  | 'STORY'
  | 'PROFILE'
  | 'TRUST_ROOM'
  | 'LIVE_REPLAY';

export type UploadState =
  | 'CREATED'
  | 'PREPARING'
  | 'PAUSED'
  | 'UPLOADING'
  | 'PROCESSING'
  | 'READY'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED';

export type MediaKind = 'image' | 'video' | 'audio' | 'document';

export type MediaPrivacy = 'PUBLIC' | 'CONNECTIONS' | 'TRUSTED_CIRCLE' | 'PRIVATE';

export interface MediaAsset {
  id: string;
  ownerId: string;
  kind: string;
  status: string;
  bucket: string;
  objectKey: string;
  originalName?: string | null;
  mimeType: string;
  sizeBytes: number;
  isEncrypted: boolean;
  videoAsset?: {
    id: string;
    status: string;
    masterPlaylistKey?: string | null;
    previewPlaylistKey?: string | null;
    posterObjectKey?: string | null;
    durationMillis?: number | null;
    width?: number | null;
    height?: number | null;
    videoCodec?: string | null;
    audioCodec?: string | null;
    variants: Array<{
      id: string; label: string; status: string; playlistObjectKey: string;
      initSegmentKey?: string | null; segmentPrefix?: string | null; container: string;
      videoCodec?: string | null; audioCodec?: string | null; width?: number | null;
      height?: number | null; bitrateKbps?: number | null; frameRate?: number | null;
      durationMillis?: number | null;
    }>;
  } | null;
  thumbnails: Array<{ id: string; objectKey: string; mimeType: string; width: number; height: number; sizeBytes: number }>;
}

export interface MediaPage {
  items: MediaAsset[];
  nextCursor?: string | null;
  hasMore: boolean;
}

export interface MediaAlbum {
  id: string;
  name: string;
  description?: string;
  coverUrl?: string;
  itemCount: number;
  privacy: MediaPrivacy;
  createdAt: string;
  updatedAt: string;
}

export interface MediaAlbumPage {
  items: MediaAlbum[];
  nextCursor?: string | null;
  hasMore: boolean;
}

export interface UploadPart {
  partNumber: number;
  url: string;
  headers?: Record<string, string>;
}

export interface UploadSession {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  context: MediaUsageContext;
  state: UploadState;
  progress: number;
  uploadedBytes: number;
  speedBytesPerSec: number;
  timeRemainingSec: number;
  processingStep?: string;
  error?: string;
  mediaId?: string;
  mediaUrl?: string;
  createdAt: string;
  updatedAt: string;
  chunkSizeBytes?: number;
  totalParts?: number;
  completedParts?: number[];
}

export interface UploadInitResponse {
  uploadId: string;
  mode: 'single' | 'multipart';
  chunkSizeBytes?: number;
  totalParts?: number;
  uploadUrl?: string;
  uploadHeaders?: Record<string, string>;
  parts?: UploadPart[];
  expiresAt: string;
  mediaId?: string;
}

export interface UploadCompleteResponse {
  mediaFileId: string;
  status?: string;
}

export interface SignedRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  expiresAt: string;
}

export interface PlaybackGrant {
  id: string;
  status: string;
  maxViews?: number | null;
  usedViews: number;
  expiresAt: number;
  mediaId: string;
  request: SignedRequest;
  masterManifestUrl: string;
  variants: Array<{ resolution: '1080p' | '720p' | '480p' | '360p' | 'auto'; url: string }>;
}

export interface PlaybackGrantResponse {
  grant: PlaybackGrant;
}
