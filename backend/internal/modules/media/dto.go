package media

import "time"

type CreateUploadSessionRequest struct {
	Purpose        string `json:"purpose" validate:"required,oneof=POST_ATTACHMENT CHAT_ATTACHMENT CLIP STORY PROFILE TRUST_ROOM LIVE_REPLAY"`
	FileName       string `json:"fileName" validate:"required,min=1,max=255"`
	MimeType       string `json:"mimeType" validate:"required,min=3,max=120"`
	SizeBytes      int64  `json:"sizeBytes" validate:"required,min=1,max=2147483648"`
	ChecksumSHA256 string `json:"checksumSha256" validate:"omitempty,len=64,hexadecimal"`
	Multipart      bool   `json:"multipart"`
	PartSizeBytes  int64  `json:"partSizeBytes" validate:"omitempty,min=5242880,max=52428800"`
}

type RequestUploadPartRequest struct {
	PartNumber int `json:"partNumber" validate:"required,min=1,max=10000"`
}

type CompletedUploadPart struct {
	PartNumber int    `json:"partNumber" validate:"required,min=1,max=10000"`
	ETag       string `json:"etag" validate:"required,min=1,max=255"`
	SizeBytes  int64  `json:"sizeBytes" validate:"required,min=1"`
}

type CompleteUploadSessionRequest struct {
	Parts []CompletedUploadPart `json:"parts" validate:"required,min=1,dive"`
}

type AbortUploadSessionRequest struct {
	Reason string `json:"reason" validate:"omitempty,max=255"`
}

type CreatePlaybackGrantRequest struct {
	Reason   string `json:"reason" validate:"required,min=3,max=80"`
	MaxViews *int   `json:"maxViews" validate:"omitempty,min=1,max=50"`
}

type SignedRequestResponse struct {
	Method    string            `json:"method"`
	URL       string            `json:"url"`
	Headers   map[string]string `json:"headers"`
	ExpiresAt time.Time         `json:"expiresAt"`
}

type UploadPartGrantResponse struct {
	PartNumber int                   `json:"partNumber"`
	Request    SignedRequestResponse `json:"request"`
}

type UploadSessionResponse struct {
	ID            string                    `json:"id"`
	MediaFileID   string                    `json:"mediaFileId"`
	Purpose       string                    `json:"purpose"`
	Status        string                    `json:"status"`
	Bucket        string                    `json:"bucket"`
	ObjectKey     string                    `json:"objectKey"`
	FileName      string                    `json:"fileName"`
	MimeType      string                    `json:"mimeType"`
	SizeBytes     int64                     `json:"sizeBytes"`
	PartSizeBytes int64                     `json:"partSizeBytes"`
	TotalParts    int                       `json:"totalParts"`
	ExpiresAt     time.Time                 `json:"expiresAt"`
	PartGrants    []UploadPartGrantResponse `json:"partGrants,omitempty"`
}

type VideoVariantResponse struct {
	ID                string   `json:"id"`
	Label             string   `json:"label"`
	Status            string   `json:"status"`
	PlaylistObjectKey string   `json:"playlistObjectKey"`
	InitSegmentKey    *string  `json:"initSegmentKey,omitempty"`
	SegmentPrefix     *string  `json:"segmentPrefix,omitempty"`
	Container         string   `json:"container"`
	VideoCodec        *string  `json:"videoCodec,omitempty"`
	AudioCodec        *string  `json:"audioCodec,omitempty"`
	Width             *int     `json:"width,omitempty"`
	Height            *int     `json:"height,omitempty"`
	BitrateKbps       *int     `json:"bitrateKbps,omitempty"`
	FrameRate         *float64 `json:"frameRate,omitempty"`
	DurationMillis    *int     `json:"durationMillis,omitempty"`
}

type VideoAssetResponse struct {
	ID                 string                 `json:"id"`
	Status             string                 `json:"status"`
	MasterPlaylistKey  *string                `json:"masterPlaylistKey,omitempty"`
	PreviewPlaylistKey *string                `json:"previewPlaylistKey,omitempty"`
	PosterObjectKey    *string                `json:"posterObjectKey,omitempty"`
	DurationMillis     *int                   `json:"durationMillis,omitempty"`
	Width              *int                   `json:"width,omitempty"`
	Height             *int                   `json:"height,omitempty"`
	VideoCodec         *string                `json:"videoCodec,omitempty"`
	AudioCodec         *string                `json:"audioCodec,omitempty"`
	Variants           []VideoVariantResponse `json:"variants,omitempty"`
}

type ThumbnailResponse struct {
	ID        string `json:"id"`
	ObjectKey string `json:"objectKey"`
	MimeType  string `json:"mimeType"`
	Width     int    `json:"width"`
	Height    int    `json:"height"`
	SizeBytes int64  `json:"sizeBytes"`
}

type MediaAssetResponse struct {
	ID           string              `json:"id"`
	OwnerID      string              `json:"ownerId"`
	Kind         string              `json:"kind"`
	Status       string              `json:"status"`
	Bucket       string              `json:"bucket"`
	ObjectKey    string              `json:"objectKey"`
	OriginalName *string             `json:"originalName,omitempty"`
	MimeType     string              `json:"mimeType"`
	SizeBytes    int64               `json:"sizeBytes"`
	IsEncrypted  bool                `json:"isEncrypted"`
	VideoAsset   *VideoAssetResponse `json:"videoAsset,omitempty"`
	Thumbnails   []ThumbnailResponse `json:"thumbnails,omitempty"`
}

type PlaybackGrantResponse struct {
	ID              string                           `json:"id"`
	Status          string                           `json:"status"`
	MaxViews        *int                             `json:"maxViews,omitempty"`
	UsedViews       int                              `json:"usedViews"`
	ExpiresAt       time.Time                        `json:"expiresAt"`
	Request         SignedRequestResponse            `json:"request"`
	AdaptiveRequest *SignedRequestResponse           `json:"adaptiveRequest,omitempty"`
	VariantRequests map[string]SignedRequestResponse `json:"variantRequests,omitempty"`
}

type AcceptedResponse struct {
	Accepted bool `json:"accepted"`
}

type CreateUploadIntentRequest = CreateUploadSessionRequest
type FinalizeUploadRequest = CompleteUploadSessionRequest
type UploadIntentResponse = UploadSessionResponse
