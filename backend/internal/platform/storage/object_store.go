package storage

import (
	"context"
	"io"
)

// ObjectStore abstracts the actual read/write/compose operations for the media
// gateway, independent of whether objects live on local disk or on an
// S3-compatible object store.
type ObjectStore interface {
	Provider() string
	PutPart(ctx context.Context, bucket, objectKey string, partNumber int, body io.Reader, size int64, contentType string) (int64, string, error)
	GetObject(ctx context.Context, bucket, objectKey string) (io.ReadCloser, int64, string, error)
	ComposeObject(ctx context.Context, bucket, destObjectKey string, partObjectKeys []string) error
	DeleteObjects(ctx context.Context, bucket string, objectKeys []string) error
	ListObjects(ctx context.Context, bucket, prefix string, limit int) ([]string, error)
	ResolvePartKey(objectKey string, partNumber int) string
}
