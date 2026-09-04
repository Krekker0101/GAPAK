package storage

import (
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/gapak/backend/internal/config"
)

func testR2Storage(t *testing.T) *S3Storage {
	t.Helper()
	store, err := NewS3Storage(config.StorageConfig{
		Endpoint:         "https://account-id.r2.cloudflarestorage.com",
		Region:           "auto",
		AccessKeyID:      "test-access-key",
		SecretAccessKey:  "test-secret-key",
		ProtectedBaseURL: "https://api.gapak.example/api/v1/media/protected",
		SigningSecret:    "test-storage-signing-secret-at-least-32-bytes",
	})
	if err != nil {
		t.Fatal(err)
	}
	return store
}

func TestR2UploadUsesDirectPresignedURL(t *testing.T) {
	store := testR2Storage(t)
	request := store.PresignUploadPart(UploadPartRequest{
		Bucket:      "gapak-media-prod",
		ObjectKey:   "owner/story/example.mp4",
		PartNumber:  1,
		ContentType: "video/mp4",
		ExpiresAt:   time.Now().Add(15 * time.Minute),
	})

	parsed, err := url.Parse(request.URL)
	if err != nil {
		t.Fatal(err)
	}
	if request.Method != "PUT" || parsed.Host != "account-id.r2.cloudflarestorage.com" {
		t.Fatalf("expected direct R2 upload URL, got %s %s", request.Method, request.URL)
	}
}

func TestR2HLSPlaybackUsesProtectedGateway(t *testing.T) {
	store := testR2Storage(t)
	request := store.PresignPlayback(PlaybackRequest{
		Bucket:       "gapak-media-prod",
		ObjectKey:    "owner/clip/example.m3u8",
		ViewerUserID: "viewer-id",
		GrantID:      "grant-id",
		ExpiresAt:    time.Now().Add(15 * time.Minute),
	})

	if request.Method != "GET" || !strings.HasPrefix(request.URL, "https://api.gapak.example/api/v1/media/protected/object?") {
		t.Fatalf("expected protected HLS gateway URL, got %s %s", request.Method, request.URL)
	}
}

func TestR2OrdinaryPlaybackUsesDirectPresignedURL(t *testing.T) {
	store := testR2Storage(t)
	request := store.PresignPlayback(PlaybackRequest{
		Bucket:    "gapak-media-prod",
		ObjectKey: "owner/story/example.webp",
		ExpiresAt: time.Now().Add(15 * time.Minute),
	})

	parsed, err := url.Parse(request.URL)
	if err != nil {
		t.Fatal(err)
	}
	if request.Method != "GET" || parsed.Host != "account-id.r2.cloudflarestorage.com" {
		t.Fatalf("expected direct R2 playback URL, got %s %s", request.Method, request.URL)
	}
}
