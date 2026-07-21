package storage

import (
	"encoding/base64"
	"strings"
	"time"

	"github.com/gapak/backend/internal/config"
	"github.com/gapak/backend/internal/domain/enums"
)

// Service is the abstraction used by the media module for generating signed
// upload and playback URLs. Implementations may be local (gateway) or
// S3-compatible (presigned URLs).
type Service interface {
	Provider() string
	BuildObjectKey(ownerID string, purpose enums.UploadPurpose, fileName string) string
	PresignUploadPart(req UploadPartRequest) SignedRequest
	PresignPlayback(req PlaybackRequest) SignedRequest
}

type SignedRequest struct {
	Method    string            `json:"method"`
	URL       string            `json:"url"`
	Headers   map[string]string `json:"headers"`
	ExpiresAt time.Time         `json:"expiresAt"`
}

type UploadPartRequest struct {
	Bucket          string
	ObjectKey       string
	UploadSessionID string
	PartNumber      int
	ContentType     string
	ExpiresAt       time.Time
}

type PlaybackRequest struct {
	Bucket       string
	ObjectKey    string
	ViewerUserID string
	GrantID      string
	ExpiresAt    time.Time
}

// GatewaySigner is the previous name for the local storage implementation.
// It is kept as a type alias for backward compatibility in tests.
type GatewaySigner = LocalStorage

// NewGatewaySigner is an alias for NewLocalStorage.
func NewGatewaySigner(cfg config.StorageConfig) *GatewaySigner {
	return NewLocalStorage(cfg)
}

func EncodeOpaqueToken(parts ...string) string {
	return base64.RawURLEncoding.EncodeToString([]byte(strings.Join(parts, "|")))
}
