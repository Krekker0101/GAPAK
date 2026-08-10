package media

import (
	"testing"
	"time"

	"github.com/gapak/backend/internal/config"
	"github.com/gapak/backend/internal/domain/enums"
	"github.com/gapak/backend/internal/domain/model"
)

func TestNormalizeUploadRequestRejectsDisallowedMimeType(t *testing.T) {
	service := &Service{
		config: config.Config{
			Storage: config.StorageConfig{
				MaxUploadBytes:   10 * 1024 * 1024,
				AllowedMIMETypes: []string{"image/jpeg", "video/mp4"},
			},
		},
	}

	_, err := service.normalizeUploadRequest(CreateUploadSessionRequest{
		Purpose:   "POST_ATTACHMENT",
		FileName:  "archive.zip",
		MimeType:  "application/zip",
		SizeBytes: 1024,
	})
	if err == nil {
		t.Fatal("expected disallowed MIME type to be rejected")
	}
}

func TestValidateCompletedPartsRequiresAllExpectedParts(t *testing.T) {
	service := &Service{}
	session := &model.UploadSession{
		Status:     enums.UploadSessionInitiated,
		TotalParts: 2,
		SizeBytes:  2048,
		ExpiresAt:  time.Now().Add(time.Hour),
	}

	err := service.validateCompletedParts(session, []CompletedUploadPart{
		{PartNumber: 1, ETag: "etag-1", SizeBytes: 1024},
	})
	if err == nil {
		t.Fatal("expected incomplete multipart upload to be rejected")
	}
}

func TestValidateCompletedPartsRequiresExactDeclaredSize(t *testing.T) {
	service := &Service{}
	session := &model.UploadSession{TotalParts: 2, SizeBytes: 2048}
	err := service.validateCompletedParts(session, []CompletedUploadPart{
		{PartNumber: 1, ETag: "a", SizeBytes: 1024},
		{PartNumber: 2, ETag: "b", SizeBytes: 1023},
	})
	if err == nil {
		t.Fatal("expected exact size validation to reject under-sized upload")
	}
}

func TestValidateCompletedPartsRejectsOverSizedUpload(t *testing.T) {
	service := &Service{}
	session := &model.UploadSession{TotalParts: 2, SizeBytes: 2048}
	err := service.validateCompletedParts(session, []CompletedUploadPart{
		{PartNumber: 1, ETag: "a", SizeBytes: 1024},
		{PartNumber: 2, ETag: "b", SizeBytes: 2049},
	})
	if err == nil {
		t.Fatal("expected over-sized upload to be rejected")
	}
}
