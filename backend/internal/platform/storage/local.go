package storage

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/gapak/backend/internal/config"
	"github.com/gapak/backend/internal/domain/enums"
)

// LocalStorage implements both the Service (presigned URL generation) and
// ObjectStore (read/write/compose) interfaces for a local-disk object layout.
type LocalStorage struct {
	cfg config.StorageConfig
}

func NewLocalStorage(cfg config.StorageConfig) *LocalStorage {
	return &LocalStorage{cfg: cfg}
}

func (s *LocalStorage) Provider() string {
	return "local"
}

func (s *LocalStorage) BuildObjectKey(ownerID string, purpose enums.UploadPurpose, fileName string) string {
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

func (s *LocalStorage) PresignUploadPart(req UploadPartRequest) SignedRequest {
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
		URL:       base + "/gateway/multipart/upload?" + values.Encode(),
		Headers:   map[string]string{"Content-Type": req.ContentType},
		ExpiresAt: expiresAt,
	}
}

func (s *LocalStorage) PresignPlayback(req PlaybackRequest) SignedRequest {
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

func (s *LocalStorage) signature(parts ...string) string {
	mac := hmac.New(sha256.New, []byte(s.cfg.SigningSecret))
	mac.Write([]byte(strings.Join(parts, "|")))
	return hex.EncodeToString(mac.Sum(nil))
}

func (s *LocalStorage) PutPart(ctx context.Context, bucket, objectKey string, partNumber int, body io.Reader, size int64, contentType string) (int64, string, error) {
	partKey := s.ResolvePartKey(objectKey, partNumber)
	partPath := s.resolvePath(bucket, partKey)

	if err := os.MkdirAll(filepath.Dir(partPath), 0o755); err != nil {
		return 0, "", err
	}

	file, err := os.Create(partPath)
	if err != nil {
		return 0, "", err
	}
	defer file.Close()

	written, err := io.CopyN(file, body, size)
	if err != nil && err != io.EOF {
		_ = os.Remove(partPath)
		return 0, "", err
	}
	if written != size {
		_ = os.Remove(partPath)
		return 0, "", fmt.Errorf("expected to write %d bytes, wrote %d", size, written)
	}
	return written, "", file.Close()
}

func (s *LocalStorage) GetObject(ctx context.Context, bucket, objectKey string) (io.ReadCloser, int64, string, error) {
	path := s.resolvePath(bucket, objectKey)
	info, err := os.Stat(path)
	if err != nil {
		return nil, 0, "", err
	}
	f, err := os.Open(path)
	if err != nil {
		return nil, 0, "", err
	}
	contentType := ""
	if ext := strings.ToLower(filepath.Ext(objectKey)); ext != "" {
		contentType = mimeByExtension(ext)
	}
	return f, info.Size(), contentType, nil
}

func (s *LocalStorage) ComposeObject(ctx context.Context, bucket, destObjectKey string, partObjectKeys []string) error {
	if len(partObjectKeys) == 0 {
		return fmt.Errorf("no parts to compose")
	}
	destPath := s.resolvePath(bucket, destObjectKey)
	if err := os.MkdirAll(filepath.Dir(destPath), 0o755); err != nil {
		return err
	}

	if len(partObjectKeys) == 1 {
		partPath := s.resolvePath(bucket, partObjectKeys[0])
		return os.Rename(partPath, destPath)
	}

	tmpPath := destPath + ".assembling"
	out, err := os.OpenFile(tmpPath, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o600)
	if err != nil {
		return err
	}
	var written int64
	for _, key := range partObjectKeys {
		partPath := s.resolvePath(bucket, key)
		f, err := os.Open(partPath)
		if err != nil {
			_ = out.Close()
			_ = os.Remove(tmpPath)
			return err
		}
		n, err := io.Copy(out, f)
		_ = f.Close()
		if err != nil {
			_ = out.Close()
			_ = os.Remove(tmpPath)
			return err
		}
		written += n
	}
	if err := out.Close(); err != nil {
		_ = os.Remove(tmpPath)
		return err
	}
	if err := os.Rename(tmpPath, destPath); err != nil {
		_ = os.Remove(tmpPath)
		return err
	}

	s.DeleteObjects(ctx, bucket, partObjectKeys)
	return nil
}

func (s *LocalStorage) DeleteObjects(ctx context.Context, bucket string, objectKeys []string) error {
	for _, key := range objectKeys {
		_ = os.Remove(s.resolvePath(bucket, key))
	}
	return nil
}

func (s *LocalStorage) ResolvePartKey(objectKey string, partNumber int) string {
	return fmt.Sprintf("%s.part.%d", objectKey, partNumber)
}

func (s *LocalStorage) resolvePath(bucket, objectKey string) string {
	root := filepath.Clean(s.cfg.LocalRootPath)
	baseDir := filepath.Join(root, filepath.Clean(bucket))
	targetPath := filepath.Join(baseDir, filepath.FromSlash(filepath.Clean(objectKey)))
	if rel, err := filepath.Rel(baseDir, targetPath); err != nil || strings.HasPrefix(rel, "..") {
		// defensive: shouldn't happen with Clean, but avoid writing outside root
		targetPath = filepath.Join(baseDir, filepath.Base(objectKey))
	}
	return targetPath
}

func mimeByExtension(ext string) string {
	switch ext {
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".png":
		return "image/png"
	case ".webp":
		return "image/webp"
	case ".mp4":
		return "video/mp4"
	case ".webm":
		return "video/webm"
	case ".pdf":
		return "application/pdf"
	case ".m3u8":
		return "application/vnd.apple.mpegurl"
	case ".mpd":
		return "application/dash+xml"
	default:
		return ""
	}
}
