package storage

import (
	"testing"
	"time"

	"github.com/gapak/backend/internal/config"
	"github.com/gapak/backend/internal/domain/enums"
)

func TestGatewaySigner_BuildObjectKey_NoDateInPath(t *testing.T) {
	signer := NewGatewaySigner(validStorageConfig())
	key := signer.BuildObjectKey("user123", enums.UploadPurposePostAttachment, "photo.jpg")
	if containsDatePath(key) {
		t.Errorf("object key should not contain date path segments, got: %s", key)
	}
}

func TestGatewaySigner_PresignPlayback_RejectsExpiredURL(t *testing.T) {
	signer := NewGatewaySigner(validStorageConfig())
	req := PlaybackRequest{
		Bucket:       "test-bucket",
		ObjectKey:    "user123/post_attachment/abc123.jpg",
		ViewerUserID: "viewer1",
		GrantID:      "grant1",
		ExpiresAt:    time.Now().UTC().Add(-1 * time.Hour),
	}
	result := signer.PresignPlayback(req)
	if result.URL != "" {
		t.Errorf("expected empty URL for expired request, got: %s", result.URL)
	}
}

func TestGatewaySigner_PresignUploadPart_RejectsExpiredURL(t *testing.T) {
	signer := NewGatewaySigner(validStorageConfig())
	req := UploadPartRequest{
		Bucket:          "test-bucket",
		ObjectKey:       "user123/story/abc123.jpg",
		UploadSessionID: "upload1",
		PartNumber:      1,
		ContentType:     "image/jpeg",
		ExpiresAt:       time.Now().UTC().Add(-1 * time.Hour),
	}
	result := signer.PresignUploadPart(req)
	if result.URL != "" {
		t.Errorf("expected empty URL for expired request, got: %s", result.URL)
	}
}

func TestGatewaySigner_PresignPlayback_UsesNanoTimestamp(t *testing.T) {
	signer := NewGatewaySigner(validStorageConfig())
	req := PlaybackRequest{
		Bucket:       "test-bucket",
		ObjectKey:    "user123/story/abc123.jpg",
		ViewerUserID: "viewer1",
		GrantID:      "grant1",
		ExpiresAt:    time.Now().UTC().Add(15 * time.Minute),
	}
	result := signer.PresignPlayback(req)
	if result.URL == "" {
		t.Fatal("expected non-empty URL")
	}
	if result.ExpiresAt.IsZero() {
		t.Error("expected non-zero ExpiresAt in response")
	}
}

func containsDatePath(key string) bool {
	// Check for common date path patterns like "2025-04-18", "2025/04/18", "2025-4-18", etc.
	// Look for patterns: YYYY-MM-DD, YYYY/MM/DD, YYYY-M-D, YYYY/M/D
	if len(key) < 8 {
		return false
	}

	// Check for year-like patterns (4 consecutive digits followed by -)
	for i := 0; i < len(key)-5; i++ {
		// Check for YYYY- or YYYY/
		if key[i] >= '0' && key[i] <= '9' &&
			key[i+1] >= '0' && key[i+1] <= '9' &&
			key[i+2] >= '0' && key[i+2] <= '9' &&
			key[i+3] >= '0' && key[i+3] <= '9' &&
			(key[i+4] == '-' || key[i+4] == '/') {
			// Check if this looks like a valid year (20xx or 19xx)
			firstTwo := string([]byte{key[i], key[i+1]})
			if firstTwo == "20" || firstTwo == "19" {
				return true
			}
		}
	}
	return false
}

func validStorageConfig() config.StorageConfig {
	return config.StorageConfig{
		PublicBaseURL:          "https://storage.example.com",
		ProtectedBaseURL:       "https://storage.example.com/protected",
		SigningSecret:          "1234567890123456789012345678901234",
		MultipartPartSizeBytes: 8 * 1024 * 1024,
		MaxUploadBytes:         25 * 1024 * 1024,
		AllowedMIMETypes:       []string{"image/jpeg"},
		SignedURLTTL:           15 * time.Minute,
		UploadIntentTTL:        30 * time.Minute,
		PlaybackGrantTTL:       5 * time.Minute,
	}
}
