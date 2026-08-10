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
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  kind: MediaKind;
  privacy: MediaPrivacy;
  encrypted: boolean;
  createdAt: string;
  updatedAt: string;
  durationSeconds?: number;
  width?: number;
  height?: number;
  thumbnailUrl?: string;
  /** Server-authorized short-lived URL. Never synthesized client-side. */
  previewUrl?: string;
  albumId?: string | null;
  expiresAt?: string | null;
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
  uploadUrl?: string;
  uploadHeaders?: Record<string, string>;
  parts?: UploadPart[];
  expiresAt: string;
  mediaId?: string;
}

export interface UploadCompleteResponse {
  media: MediaAsset;
}

export interface HLSVariant {
  resolution: '1080p' | '720p' | '480p' | '360p' | 'auto';
  bandwidth: number;
  url: string;
  width: number;
  height: number;
}

export interface PlaybackGrant {
  mediaId: string;
  grantToken: string;
  expiresAt: number;
  streamType: 'hls' | 'mp4';
  watermarkToken?: string;
  variants: HLSVariant[];
  masterManifestUrl: string;
  captions?: Array<{ language: string; label: string; url: string }>;
}

export interface PlaybackGrantResponse {
  grant: PlaybackGrant;
}
