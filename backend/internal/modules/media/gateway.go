package media

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gapak/backend/internal/domain/model"
	apperrors "github.com/gapak/backend/internal/platform/errors"
)

type SignedUploadQuery struct {
	Bucket          string `query:"bucket" validate:"required,min=1,max=120"`
	ObjectKey       string `query:"objectKey" validate:"required,min=1,max=500"`
	UploadSessionID string `query:"uploadSessionId" validate:"required,uuid4"`
	PartNumber      int    `query:"partNumber" validate:"required,min=1,max=10000"`
	ExpiresAt       string `query:"expiresAt" validate:"required"`
	ContentType     string `query:"contentType" validate:"required,min=3,max=120"`
	Signature       string `query:"signature" validate:"required,len=64,hexadecimal"`
}

type SignedPlaybackQuery struct {
	Bucket       string `query:"bucket" validate:"required,min=1,max=120"`
	ObjectKey    string `query:"objectKey" validate:"required,min=1,max=500"`
	GrantID      string `query:"grantId" validate:"required,uuid4"`
	ViewerUserID string `query:"viewerUserId" validate:"required,uuid4"`
	ExpiresAt    string `query:"expiresAt" validate:"required"`
	Signature    string `query:"signature" validate:"required,len=64,hexadecimal"`
}

type ProtectedObject struct {
	Body     io.ReadCloser
	Size     int64
	MIMEType string
	FileName string
}

func (s *Service) UploadPart(ctx context.Context, query SignedUploadQuery, body io.Reader, partSize int64, requestContentType string) (string, error) {
	expiresAt, err := parseSignedExpiry(query.ExpiresAt)
	if err != nil {
		return "", err
	}
	if time.Now().UTC().After(expiresAt) {
		return "", apperrors.New(410, "media.signed_upload_expired", "Signed upload request has expired")
	}

	expectedSignature := s.gatewaySignature(
		"PUT",
		query.Bucket,
		query.ObjectKey,
		query.UploadSessionID,
		strconv.Itoa(query.PartNumber),
		query.ExpiresAt,
	)
	if !secureEqual(query.Signature, expectedSignature) {
		return "", apperrors.New(403, "media.signed_upload_invalid", "Signed upload request is invalid")
	}

	session, err := s.repo.FindUploadSessionByGateway(ctx, query.UploadSessionID, query.Bucket, query.ObjectKey)
	if err != nil {
		return "", err
	}
	if err := s.ensureUploadSessionActive(session); err != nil {
		return "", err
	}
	if query.PartNumber < 1 || query.PartNumber > session.TotalParts {
		return "", apperrors.New(400, "media.part_number_out_of_range", "Upload part number is outside the allowed range")
	}

	expectedContentType := strings.TrimSpace(query.ContentType)
	if expectedContentType == "" {
		expectedContentType = session.MimeType
	}
	if requestContentType != "" && !strings.EqualFold(strings.TrimSpace(requestContentType), expectedContentType) {
		return "", apperrors.New(400, "media.content_type_mismatch", "Uploaded part content type does not match the signed request")
	}

	if partSize == 0 {
		return "", apperrors.New(400, "media.empty_upload_body", "Uploaded part body cannot be empty")
	}
	maxAllowed := session.PartSizeBytes
	if query.PartNumber == session.TotalParts {
		remaining := session.SizeBytes - (session.PartSizeBytes * int64(session.TotalParts-1))
		if remaining > 0 {
			maxAllowed = remaining
		}
	}
	if partSize > maxAllowed {
		return "", apperrors.New(400, "media.part_size_invalid", "Uploaded part exceeds the declared size for this session")
	}

	hash := sha256.New()
	tee := io.TeeReader(body, hash)
	written, _, err := s.store.PutPart(ctx, session.Bucket, session.ObjectKey, query.PartNumber, tee, partSize, expectedContentType)
	if err != nil {
		return "", apperrors.New(400, "media.upload_body_read_failed", "Failed to store upload part")
	}
	if written != partSize {
		return "", apperrors.New(400, "media.upload_incomplete", "Upload body size does not match Content-Length")
	}

	etag := hex.EncodeToString(hash.Sum(nil))
	if err := s.repo.UpsertUploadPartBySession(ctx, session.ID, CompletedUploadPart{
		PartNumber: query.PartNumber,
		ETag:       etag,
		SizeBytes:  partSize,
	}); err != nil {
		return "", err
	}

	return etag, nil
}

func (s *Service) FinalizeUploadedObject(ctx context.Context, session *model.UploadSession, parts []CompletedUploadPart) error {
	if session == nil {
		return apperrors.ErrNotFound
	}

	partKeys := make([]string, 0, len(parts))
	for _, part := range parts {
		partKeys = append(partKeys, s.store.ResolvePartKey(session.ObjectKey, part.PartNumber))
	}

	if err := s.store.ComposeObject(ctx, session.Bucket, session.ObjectKey, partKeys); err != nil {
		return err
	}

	detected, err := s.detectObjectMIMEType(ctx, session.Bucket, session.ObjectKey)
	if err != nil {
		_ = s.store.DeleteObjects(ctx, session.Bucket, []string{session.ObjectKey})
		return apperrors.New(400, "media.mime_detection_failed", "Unable to detect uploaded file type")
	}
	if !strings.EqualFold(detected, session.MimeType) {
		_ = s.store.DeleteObjects(ctx, session.Bucket, []string{session.ObjectKey})
		return apperrors.New(400, "media.mime_type_mismatch", "Detected MIME type does not match declared type")
	}
	if !s.allowedMimeType(detected) {
		_ = s.store.DeleteObjects(ctx, session.Bucket, []string{session.ObjectKey})
		return apperrors.New(400, "media.mime_type_not_allowed", "Detected MIME type is not allowed")
	}
	return nil
}

func (s *Service) detectObjectMIMEType(ctx context.Context, bucket, objectKey string) (string, error) {
	reader, _, _, err := s.store.GetObject(ctx, bucket, objectKey)
	if err != nil {
		return "", err
	}
	defer reader.Close()

	buf := make([]byte, 512)
	n, err := reader.Read(buf)
	if err != nil && err != io.EOF {
		return "", err
	}
	return http.DetectContentType(buf[:n]), nil
}

func (s *Service) ResolvePlayback(ctx context.Context, query SignedPlaybackQuery) (*ProtectedObject, error) {
	expiresAt, err := parseSignedExpiry(query.ExpiresAt)
	if err != nil {
		return nil, err
	}
	if time.Now().UTC().After(expiresAt) {
		return nil, apperrors.New(410, "media.playback_signature_expired", "Signed playback request has expired")
	}

	expectedSignature := s.gatewaySignature(
		"GET",
		query.Bucket,
		query.ObjectKey,
		query.GrantID,
		query.ViewerUserID,
		query.ExpiresAt,
	)
	if !secureEqual(query.Signature, expectedSignature) {
		return nil, apperrors.New(403, "media.playback_signature_invalid", "Signed playback request is invalid")
	}

	mediaFile, err := s.repo.ConsumePlaybackGrant(ctx, query.GrantID, query.ViewerUserID, query.Bucket, query.ObjectKey)
	if err != nil {
		return nil, err
	}

	reader, size, contentType, err := s.store.GetObject(ctx, mediaFile.Bucket, mediaFile.ObjectKey)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, apperrors.ErrNotFound
		}
		return nil, err
	}

	fileName := mediaFile.ObjectKey
	if mediaFile.OriginalName != nil && strings.TrimSpace(*mediaFile.OriginalName) != "" {
		fileName = *mediaFile.OriginalName
	}

	mime := contentType
	if mime == "" {
		mime = playbackMIMEType(mediaFile.ObjectKey, mediaFile.MimeType)
	}

	return &ProtectedObject{
		Body:     reader,
		Size:     size,
		MIMEType: mime,
		FileName: fileName,
	}, nil
}

func playbackMIMEType(path, fallback string) string {
	switch strings.ToLower(filepath.Ext(path)) {
	case ".m3u8":
		return "application/vnd.apple.mpegurl"
	case ".ts":
		return "video/mp2t"
	case ".m4s":
		return "video/iso.segment"
	case ".mp4":
		return "video/mp4"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	default:
		return fallback
	}
}

func (s *Service) gatewaySignature(parts ...string) string {
	mac := hmac.New(sha256.New, []byte(s.config.Storage.SigningSecret))
	mac.Write([]byte(strings.Join(parts, "|")))
	return hex.EncodeToString(mac.Sum(nil))
}

func parseSignedExpiry(raw string) (time.Time, error) {
	value, err := time.Parse(time.RFC3339Nano, raw)
	if err != nil {
		return time.Time{}, apperrors.New(400, "media.signature_expiry_invalid", "Signed request expiry is invalid")
	}
	return value.UTC(), nil
}

func secureEqual(left, right string) bool {
	return hmac.Equal([]byte(strings.TrimSpace(left)), []byte(strings.TrimSpace(right)))
}
