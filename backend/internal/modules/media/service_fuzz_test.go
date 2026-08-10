package media

import (
	"testing"

	"github.com/gapak/backend/internal/config"
)

func FuzzNormalizeUploadRequestNeverPanics(f *testing.F) {
	f.Add("photo.jpg", "image/jpeg", int64(1024), "POST_ATTACHMENT")
	f.Add("video.mp4", "video/mp4", int64(1024), "POST_ATTACHMENT")
	f.Add("../evil", "application/octet-stream", int64(-1), "POST_ATTACHMENT")
	f.Fuzz(func(t *testing.T, name, mime string, size int64, purpose string) {
		service := &Service{config: config.Config{Storage: config.StorageConfig{
			MaxUploadBytes:   10 * 1024 * 1024,
			AllowedMIMETypes: []string{"image/jpeg", "image/png", "video/mp4", "video/webm"},
		}}}
		_, _ = service.normalizeUploadRequest(CreateUploadSessionRequest{FileName: name, MimeType: mime, SizeBytes: size, Purpose: purpose})
	})
}
