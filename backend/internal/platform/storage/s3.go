package storage

import (
	"context"
	"fmt"
	"io"
	"net/url"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"

	"github.com/gapak/backend/internal/config"
	"github.com/gapak/backend/internal/domain/enums"
)

// S3Storage implements Service (presigned URLs) and ObjectStore for any
// S3-compatible object storage (AWS S3, MinIO, Cloudflare R2, etc.).
type S3Storage struct {
	cfg    config.StorageConfig
	client *minio.Client
}

func NewS3Storage(cfg config.StorageConfig) (*S3Storage, error) {
	if cfg.AccessKeyID == "" || cfg.SecretAccessKey == "" {
		return nil, fmt.Errorf("s3 storage requires ACCESS_KEY_ID and SECRET_ACCESS_KEY")
	}

	endpoint := cfg.Endpoint
	secure := !strings.HasPrefix(strings.ToLower(endpoint), "http://")
	endpoint = strings.TrimPrefix(endpoint, "http://")
	endpoint = strings.TrimPrefix(endpoint, "https://")

	client, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.AccessKeyID, cfg.SecretAccessKey, ""),
		Secure: secure,
		Region: cfg.Region,
	})
	if err != nil {
		return nil, err
	}

	return &S3Storage{cfg: cfg, client: client}, nil
}

func (s *S3Storage) Provider() string {
	return "s3"
}

func (s *S3Storage) BuildObjectKey(ownerID string, purpose enums.UploadPurpose, fileName string) string {
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

func (s *S3Storage) PresignUploadPart(req UploadPartRequest) SignedRequest {
	expiresAt := req.ExpiresAt.UTC()
	if expiresAt.Before(time.Now().UTC()) {
		return SignedRequest{Method: "PUT", URL: "", Headers: map[string]string{}, ExpiresAt: time.Time{}}
	}

	partKey := s.ResolvePartKey(req.ObjectKey, req.PartNumber)
	expires := time.Until(expiresAt)
	if expires <= 0 {
		return SignedRequest{Method: "PUT", URL: "", Headers: map[string]string{}, ExpiresAt: time.Time{}}
	}

	presignedURL, err := s.client.PresignedPutObject(context.Background(), req.Bucket, partKey, expires)
	if err != nil {
		return SignedRequest{Method: "PUT", URL: "", Headers: map[string]string{}, ExpiresAt: time.Time{}}
	}

	return SignedRequest{
		Method:    "PUT",
		URL:       presignedURL.String(),
		Headers:   map[string]string{"Content-Type": req.ContentType},
		ExpiresAt: expiresAt,
	}
}

func (s *S3Storage) PresignPlayback(req PlaybackRequest) SignedRequest {
	expiresAt := req.ExpiresAt.UTC()
	if expiresAt.Before(time.Now().UTC()) {
		return SignedRequest{Method: "GET", URL: "", Headers: map[string]string{}, ExpiresAt: time.Time{}}
	}

	expires := time.Until(expiresAt)
	if expires <= 0 {
		return SignedRequest{Method: "GET", URL: "", Headers: map[string]string{}, ExpiresAt: time.Time{}}
	}

	reqParams := url.Values{}
	presignedURL, err := s.client.PresignedGetObject(context.Background(), req.Bucket, req.ObjectKey, expires, reqParams)
	if err != nil {
		return SignedRequest{Method: "GET", URL: "", Headers: map[string]string{}, ExpiresAt: time.Time{}}
	}

	return SignedRequest{
		Method:    "GET",
		URL:       presignedURL.String(),
		Headers:   map[string]string{},
		ExpiresAt: expiresAt,
	}
}

func (s *S3Storage) PutPart(ctx context.Context, bucket, objectKey string, partNumber int, body io.Reader, size int64, contentType string) (int64, string, error) {
	partKey := s.ResolvePartKey(objectKey, partNumber)
	limited := io.LimitReader(body, size)
	info, err := s.client.PutObject(ctx, bucket, partKey, limited, size, minio.PutObjectOptions{
		ContentType: contentType,
	})
	if err != nil {
		return 0, "", err
	}
	// size is an upper bound; the client returns the actual bytes uploaded.
	return info.Size, info.ETag, nil
}

func (s *S3Storage) GetObject(ctx context.Context, bucket, objectKey string) (io.ReadCloser, int64, string, error) {
	stat, err := s.client.StatObject(ctx, bucket, objectKey, minio.StatObjectOptions{})
	if err != nil {
		return nil, 0, "", err
	}
	obj, err := s.client.GetObject(ctx, bucket, objectKey, minio.GetObjectOptions{})
	if err != nil {
		return nil, 0, "", err
	}
	contentType := stat.ContentType
	if contentType == "" {
		contentType = mimeByExtension(strings.ToLower(filepath.Ext(objectKey)))
	}
	return obj, stat.Size, contentType, nil
}

func (s *S3Storage) ComposeObject(ctx context.Context, bucket, destObjectKey string, partObjectKeys []string) error {
	if len(partObjectKeys) == 0 {
		return fmt.Errorf("no parts to compose")
	}

	dest := minio.CopyDestOptions{
		Bucket: bucket,
		Object: destObjectKey,
	}

	if len(partObjectKeys) == 1 {
		src := minio.CopySrcOptions{
			Bucket: bucket,
			Object: partObjectKeys[0],
		}
		if _, err := s.client.CopyObject(ctx, dest, src); err != nil {
			return err
		}
	} else {
		sources := make([]minio.CopySrcOptions, len(partObjectKeys))
		for i, key := range partObjectKeys {
			sources[i] = minio.CopySrcOptions{
				Bucket: bucket,
				Object: key,
			}
		}
		if _, err := s.client.ComposeObject(ctx, dest, sources...); err != nil {
			return err
		}
	}

	objectsCh := make(chan minio.ObjectInfo, len(partObjectKeys))
	for _, key := range partObjectKeys {
		objectsCh <- minio.ObjectInfo{Key: key}
	}
	close(objectsCh)
	for rerr := range s.client.RemoveObjects(ctx, bucket, objectsCh, minio.RemoveObjectsOptions{}) {
		if rerr.Err != nil {
			// Log? Returning first error is enough to surface the problem.
			return rerr.Err
		}
	}
	return nil
}

func (s *S3Storage) DeleteObjects(ctx context.Context, bucket string, objectKeys []string) error {
	if len(objectKeys) == 0 {
		return nil
	}
	objectsCh := make(chan minio.ObjectInfo, len(objectKeys))
	for _, key := range objectKeys {
		objectsCh <- minio.ObjectInfo{Key: key}
	}
	close(objectsCh)
	for rerr := range s.client.RemoveObjects(ctx, bucket, objectsCh, minio.RemoveObjectsOptions{}) {
		if rerr.Err != nil {
			return rerr.Err
		}
	}
	return nil
}

func (s *S3Storage) ListObjects(ctx context.Context, bucket, prefix string, limit int) ([]string, error) {
	if limit <= 0 {
		limit = 10000
	}
	items := make([]string, 0, minInt(limit, 128))
	for item := range s.client.ListObjects(ctx, bucket, minio.ListObjectsOptions{Prefix: prefix, Recursive: true}) {
		if item.Err != nil {
			return nil, item.Err
		}
		items = append(items, item.Key)
		if len(items) >= limit {
			break
		}
	}
	return items, nil
}

func (s *S3Storage) ResolvePartKey(objectKey string, partNumber int) string {
	return fmt.Sprintf("%s.part.%d", objectKey, partNumber)
}
