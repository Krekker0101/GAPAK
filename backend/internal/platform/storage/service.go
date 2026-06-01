package storage

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"net/url"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/gapak/backend/internal/config"
	"github.com/gapak/backend/internal/domain/enums"
)

type Service interface {
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

type GatewaySigner struct {
	cfg config.StorageConfig
}

func NewGatewaySigner(cfg config.StorageConfig) *GatewaySigner {
	return &GatewaySigner{cfg: cfg}
}

func (s *GatewaySigner) BuildObjectKey(ownerID string, purpose enums.UploadPurpose, fileName string) string {
	ext := strings.ToLower(filepath.Ext(fileName))
	if ext == "" {
		ext = ".bin"
	}
	return strings.Join([]string{
		ownerID,
		strings.ToLower(string(purpose)),
		uuid.NewString() + ext,
	}, "/")
}

func (s *GatewaySigner) PresignUploadPart(req UploadPartRequest) SignedRequest {
	expiresAt := req.ExpiresAt.UTC()
	if expiresAt.Before(time.Now().UTC()) {
		return SignedRequest{
			Method:    "PUT",
			URL:       "",
			Headers:   map[string]string{},
			ExpiresAt: time.Time{},
		}
	}
	base := strings.TrimRight(s.cfg.PublicBaseURL, "/")
	if base == "" {
		base = "https://storage.local"
	}

	values := url.Values{}
	values.Set("bucket", req.Bucket)
	values.Set("objectKey", req.ObjectKey)
	values.Set("uploadSessionId", req.UploadSessionID)
	values.Set("partNumber", strconv.Itoa(req.PartNumber))
	values.Set("expiresAt", expiresAt.Format(time.RFC3339Nano))
	values.Set("contentType", req.ContentType)
	values.Set("signature", s.signature("PUT", req.Bucket, req.ObjectKey, req.UploadSessionID, strconv.Itoa(req.PartNumber), expiresAt.Format(time.RFC3339Nano)))

	return SignedRequest{
		Method:    "PUT",
		URL:       base + "/multipart/upload?" + values.Encode(),
		Headers:   map[string]string{"Content-Type": req.ContentType},
		ExpiresAt: expiresAt,
	}
}

func (s *GatewaySigner) PresignPlayback(req PlaybackRequest) SignedRequest {
	expiresAt := req.ExpiresAt.UTC()
	if expiresAt.Before(time.Now().UTC()) {
		return SignedRequest{
			Method:    "GET",
			URL:       "",
			Headers:   map[string]string{},
			ExpiresAt: time.Time{},
		}
	}
	base := strings.TrimRight(s.cfg.ProtectedBaseURL, "/")
	if base == "" {
		base = "https://storage.local/protected"
	}

	values := url.Values{}
	values.Set("bucket", req.Bucket)
	values.Set("objectKey", req.ObjectKey)
	values.Set("grantId", req.GrantID)
	values.Set("viewerUserId", req.ViewerUserID)
	values.Set("expiresAt", expiresAt.Format(time.RFC3339Nano))
	values.Set("signature", s.signature("GET", req.Bucket, req.ObjectKey, req.GrantID, req.ViewerUserID, expiresAt.Format(time.RFC3339Nano)))

	return SignedRequest{
		Method:    "GET",
		URL:       base + "/object?" + values.Encode(),
		Headers:   map[string]string{},
		ExpiresAt: expiresAt,
	}
}

func (s *GatewaySigner) signature(parts ...string) string {
	mac := hmac.New(sha256.New, []byte(s.cfg.SigningSecret))
	mac.Write([]byte(strings.Join(parts, "|")))
	return hex.EncodeToString(mac.Sum(nil))
}

func EncodeOpaqueToken(parts ...string) string {
	return base64.RawURLEncoding.EncodeToString([]byte(strings.Join(parts, "|")))
}
