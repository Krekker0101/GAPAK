export type UploadPurpose =
  | "POST_ATTACHMENT"
  | "CHAT_ATTACHMENT"
  | "CLIP"
  | "STORY"
  | "PROFILE"
  | "TRUST_ROOM"
  | "LIVE_REPLAY";

export type CreateUploadSessionRequest = {
  purpose: UploadPurpose;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256?: string;
  multipart?: boolean;
  partSizeBytes?: number;
};

export type SignedRequestResponse = {
  method: "PUT" | "GET";
  url: string;
  headers: Record<string, string>;
  expiresAt: string;
};

export type UploadPartGrantResponse = {
  partNumber: number;
  request: SignedRequestResponse;
};

export type UploadSessionResponse = {
  id: string;
  mediaFileId: string;
  purpose: UploadPurpose;
  status: string;
  bucket: string;
  objectKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  partSizeBytes: number;
  totalParts: number;
  expiresAt: string;
  partGrants?: UploadPartGrantResponse[];
};

export type CompletedUploadPart = {
  partNumber: number;
  etag: string;
  sizeBytes: number;
};

export type CompleteUploadSessionRequest = {
  parts: CompletedUploadPart[];
};

export type PlaybackGrantResponse = {
  id: string;
  status: string;
  maxViews?: number | null;
  usedViews: number;
  expiresAt: string;
  request: SignedRequestResponse;
  adaptiveRequest?: SignedRequestResponse | null;
  variantRequests?: Record<string, SignedRequestResponse> | null;
};

export type VideoVariantResponse = {
  id: string;
  label: string;
  status: string;
  playlistObjectKey: string;
  container: string;
  width?: number | null;
  height?: number | null;
  bitrateKbps?: number | null;
  durationMillis?: number | null;
};

export type VideoAssetResponse = {
  id: string;
  status: string;
  masterPlaylistKey?: string | null;
  previewPlaylistKey?: string | null;
  posterObjectKey?: string | null;
  durationMillis?: number | null;
  width?: number | null;
  height?: number | null;
  variants?: VideoVariantResponse[];
};

export type MediaAssetResponse = {
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
  videoAsset?: VideoAssetResponse | null;
};
