package media

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"net/http"
	"net/url"
	"os"
	"path"
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

const maxHLSPlaylistBytes = 1 << 20

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
		query.ContentType,
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

	expectedContentType := strings.TrimSpace(session.MimeType)
	if !strings.EqualFold(strings.TrimSpace(query.ContentType), expectedContentType) {
		return "", apperrors.New(403, "media.content_type_signature_invalid", "Signed content type is invalid")
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

	reader, objectSize, _, err := s.store.GetObject(ctx, session.Bucket, session.ObjectKey)
	if err != nil {
		_ = s.store.DeleteObjects(ctx, session.Bucket, []string{session.ObjectKey})
		return apperrors.New(400, "media.object_verification_failed", "Uploaded object could not be verified")
	}
	hash := sha256.New()
	written, copyErr := io.Copy(hash, reader)
	_ = reader.Close()
	if copyErr != nil || written != session.SizeBytes || objectSize != session.SizeBytes {
		_ = s.store.DeleteObjects(ctx, session.Bucket, []string{session.ObjectKey})
		return apperrors.New(400, "media.object_size_invalid", "Uploaded object size does not match the declared size")
	}
	checksum := hex.EncodeToString(hash.Sum(nil))
	if sessionChecksum, ok := s.repo.GetMediaChecksum(ctx, session.MediaFileID); ok && sessionChecksum != "" && !secureEqual(sessionChecksum, checksum) {
		_ = s.store.DeleteObjects(ctx, session.Bucket, []string{session.ObjectKey})
		return apperrors.New(400, "media.checksum_mismatch", "Uploaded object checksum does not match the declared checksum")
	}
	if err := s.repo.UpdateMediaChecksum(ctx, session.MediaFileID, checksum); err != nil {
		_ = s.store.DeleteObjects(ctx, session.Bucket, []string{session.ObjectKey})
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

	if mime == "application/vnd.apple.mpegurl" || strings.HasSuffix(strings.ToLower(query.ObjectKey), ".m3u8") {
		playlist, err := s.rewriteHLSPlaylist(ctx, query, mediaFile.ID, reader)
		if err != nil {
			_ = reader.Close()
			return nil, err
		}
		_ = reader.Close()
		return &ProtectedObject{
			Body:     io.NopCloser(bytes.NewReader(playlist)),
			Size:     int64(len(playlist)),
			MIMEType: "application/vnd.apple.mpegurl",
			FileName: fileName,
		}, nil
	}

	return &ProtectedObject{
		Body:     reader,
		Size:     size,
		MIMEType: mime,
		FileName: fileName,
	}, nil
}

// rewriteHLSPlaylist converts only relative, database-authorized HLS object
// references into short-lived signed gateway URLs. Static playlists cannot
// safely point at unsigned segment paths, and a per-request playback session
// must remain valid across every segment request.
func (s *Service) rewriteHLSPlaylist(ctx context.Context, query SignedPlaybackQuery, mediaID string, reader io.Reader) ([]byte, error) {
	limited := io.LimitReader(reader, maxHLSPlaylistBytes+1)
	raw, err := io.ReadAll(limited)
	if err != nil {
		return nil, apperrors.New(400, "media.hls_playlist_read_failed", "Playback playlist could not be read")
	}
	if len(raw) > maxHLSPlaylistBytes {
		return nil, apperrors.New(413, "media.hls_playlist_too_large", "Playback playlist exceeds the allowed size")
	}

	baseObject := query.ObjectKey
	baseDir := path.Dir(baseObject)
	lines := strings.Split(string(raw), "\n")
	for i, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "#EXT-X-VERSION") || strings.HasPrefix(trimmed, "#EXTM3U") {
			continue
		}
		if strings.HasPrefix(trimmed, "#") {
			rewritten, err := rewriteURIAttribute(line, func(uri string) (string, error) {
				return s.signHLSObject(ctx, query, mediaID, baseDir, uri)
			})
			if err != nil {
				return nil, err
			}
			lines[i] = rewritten
			continue
		}
		signed, err := s.signHLSObject(ctx, query, mediaID, baseDir, trimmed)
		if err != nil {
			return nil, err
		}
		lines[i] = strings.Replace(line, trimmed, signed, 1)
	}
	return []byte(strings.Join(lines, "\n")), nil
}

func rewriteURIAttribute(line string, sign func(string) (string, error)) (string, error) {
	const prefix = `URI="`
	start := 0
	for {
		rel := strings.Index(line[start:], prefix)
		if rel < 0 {
			return line, nil
		}
		rel += start
		valueStart := rel + len(prefix)
		valueEndRel := strings.IndexByte(line[valueStart:], '"')
		if valueEndRel < 0 {
			return "", apperrors.New(403, "media.hls_uri_invalid", "Playback playlist contains a malformed URI attribute")
		}
		valueEnd := valueStart + valueEndRel
		uri := line[valueStart:valueEnd]
		signed, err := sign(uri)
		if err != nil {
			return "", err
		}
		line = line[:valueStart] + signed + line[valueEnd:]
		start = valueStart + len(signed) + 1
	}
}

func (s *Service) signHLSObject(ctx context.Context, query SignedPlaybackQuery, mediaID, baseDir, rawURI string) (string, error) {
	rawURI = strings.TrimSpace(rawURI)
	parsed, err := url.Parse(rawURI)
	if err != nil || parsed.IsAbs() || parsed.Host != "" || strings.HasPrefix(parsed.Path, "/") {
		return "", apperrors.New(403, "media.hls_uri_invalid", "Playback playlist contains an invalid object reference")
	}
	if parsed.Path == "" {
		return "", apperrors.New(403, "media.hls_uri_invalid", "Playback playlist contains an empty object reference")
	}
	objectKey := path.Clean(path.Join(baseDir, parsed.Path))
	if objectKey == "." || strings.HasPrefix(objectKey, "../") || objectKey == ".." {
		return "", apperrors.New(403, "media.hls_uri_invalid", "Playback playlist contains an unsafe object reference")
	}
	allowed, err := s.repo.playbackObjectAllowed(ctx, mediaID, query.Bucket, query.ObjectKey, query.Bucket, objectKey)
	if err != nil {
		return "", err
	}
	if !allowed {
		return "", apperrors.ErrForbidden
	}
	base := strings.TrimRight(s.config.Storage.ProtectedBaseURL, "/")
	values := url.Values{}
	values.Set("bucket", query.Bucket)
	values.Set("objectKey", objectKey)
	values.Set("grantId", query.GrantID)
	values.Set("viewerUserId", query.ViewerUserID)
	values.Set("expiresAt", query.ExpiresAt)
	values.Set("signature", s.gatewaySignature("GET", query.Bucket, objectKey, query.GrantID, query.ViewerUserID, query.ExpiresAt))
	return base + "/object?" + values.Encode(), nil
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
