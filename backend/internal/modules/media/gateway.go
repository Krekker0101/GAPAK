package media

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
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
	Path     string
	MIMEType string
	FileName string
}

func (s *Service) UploadPart(ctx context.Context, query SignedUploadQuery, body []byte, requestContentType string) (string, error) {
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

	partSize := int64(len(body))
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

	partPath, err := s.resolvePartPath(session.Bucket, session.ObjectKey, query.PartNumber)
	if err != nil {
		return "", err
	}
	if err := os.MkdirAll(filepath.Dir(partPath), 0o755); err != nil {
		return "", err
	}
	if err := os.WriteFile(partPath, body, 0o600); err != nil {
		return "", err
	}

	sum := sha256.Sum256(body)
	etag := hex.EncodeToString(sum[:])
	if err := s.repo.UpsertUploadPartBySession(ctx, session.ID, CompletedUploadPart{
		PartNumber: query.PartNumber,
		ETag:       etag,
		SizeBytes:  partSize,
	}); err != nil {
		return "", err
	}

	return etag, nil
}

func (s *Service) FinalizeUploadedObject(session *model.UploadSession, parts []CompletedUploadPart) error {
	if session == nil {
		return apperrors.ErrNotFound
	}

	objectPath, err := s.resolveObjectPath(session.Bucket, session.ObjectKey)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(objectPath), 0o755); err != nil {
		return err
	}

	if session.TotalParts == 1 {
		partPath, err := s.resolvePartPath(session.Bucket, session.ObjectKey, 1)
		if err != nil {
			return err
		}
		if err := replaceFile(partPath, objectPath); err != nil {
			return err
		}
		return nil
	}

	tmpPath := objectPath + ".assembling"
	output, err := os.OpenFile(tmpPath, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o600)
	if err != nil {
		return err
	}
	defer output.Close()

	for _, part := range parts {
		partPath, err := s.resolvePartPath(session.Bucket, session.ObjectKey, part.PartNumber)
		if err != nil {
			return err
		}
		payload, err := os.ReadFile(partPath)
		if err != nil {
			return err
		}
		if int64(len(payload)) != part.SizeBytes {
			return apperrors.New(400, "media.completed_size_invalid", "Uploaded part size does not match the finalized payload")
		}
		if _, err := output.Write(payload); err != nil {
			return err
		}
	}

	if err := output.Close(); err != nil {
		return err
	}
	if err := os.Rename(tmpPath, objectPath); err != nil {
		return err
	}

	for _, part := range parts {
		partPath, err := s.resolvePartPath(session.Bucket, session.ObjectKey, part.PartNumber)
		if err != nil {
			return err
		}
		_ = os.Remove(partPath)
	}

	return nil
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

	objectPath, err := s.resolveObjectPath(mediaFile.Bucket, mediaFile.ObjectKey)
	if err != nil {
		return nil, err
	}
	if _, err := os.Stat(objectPath); err != nil {
		if os.IsNotExist(err) {
			return nil, apperrors.ErrNotFound
		}
		return nil, err
	}

	fileName := mediaFile.ObjectKey
	if mediaFile.OriginalName != nil && strings.TrimSpace(*mediaFile.OriginalName) != "" {
		fileName = *mediaFile.OriginalName
	}
	return &ProtectedObject{
		Path:     objectPath,
		MIMEType: playbackMIMEType(objectPath, mediaFile.MimeType),
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

func (s *Service) resolveObjectPath(bucket, objectKey string) (string, error) {
	root := filepath.Clean(s.config.Storage.LocalRootPath)
	baseDir := filepath.Join(root, filepath.Clean(bucket))
	targetPath := filepath.Join(baseDir, filepath.FromSlash(filepath.Clean(objectKey)))
	relative, err := filepath.Rel(baseDir, targetPath)
	if err != nil {
		return "", err
	}
	if strings.HasPrefix(relative, "..") {
		return "", apperrors.New(400, "media.object_key_invalid", "Object key resolves outside the storage root")
	}
	return targetPath, nil
}

func (s *Service) resolvePartPath(bucket, objectKey string, partNumber int) (string, error) {
	objectPath, err := s.resolveObjectPath(bucket, objectKey)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%s.part.%d", objectPath, partNumber), nil
}

func (s *Service) gatewaySignature(parts ...string) string {
	mac := hmac.New(sha256.New, []byte(s.config.Storage.SigningSecret))
	mac.Write([]byte(strings.Join(parts, "|")))
	return hex.EncodeToString(mac.Sum(nil))
}

func parseSignedExpiry(raw string) (time.Time, error) {
	value, err := time.Parse(time.RFC3339, raw)
	if err != nil {
		return time.Time{}, apperrors.New(400, "media.signature_expiry_invalid", "Signed request expiry is invalid")
	}
	return value.UTC(), nil
}

func secureEqual(left, right string) bool {
	return hmac.Equal([]byte(strings.TrimSpace(left)), []byte(strings.TrimSpace(right)))
}

func replaceFile(sourcePath, targetPath string) error {
	if err := os.Rename(sourcePath, targetPath); err == nil {
		return nil
	}

	payload, err := os.ReadFile(sourcePath)
	if err != nil {
		return err
	}
	if err := os.WriteFile(targetPath, payload, 0o600); err != nil {
		return err
	}
	return os.Remove(sourcePath)
}
