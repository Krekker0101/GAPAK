package concurrency

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	apperrors "github.com/gapak/backend/internal/platform/errors"
)

type contextKey string

const expectedRevisionKey contextKey = "gapak.expected_revision"
const secretKey contextKey = "gapak.concurrency.secret"

type Store struct {
	db     *pgxpool.Pool
	secret []byte
}

func NewStore(db *pgxpool.Pool, secret string) *Store {
	return &Store{db: db, secret: []byte(secret)}
}

func WithExpectedRevision(ctx context.Context, revision int64) context.Context {
	return context.WithValue(ctx, expectedRevisionKey, revision)
}

func WithSecret(ctx context.Context, secret string) context.Context {
	return context.WithValue(ctx, secretKey, secret)
}

func ExpectedRevision(ctx context.Context) (int64, bool) {
	v := ctx.Value(expectedRevisionKey)
	n, ok := v.(int64)
	return n, ok
}

func ParseIfMatch(header string) (int64, bool, error) {
	header = strings.TrimSpace(header)
	if header == "" || header == "*" {
		return 0, false, nil
	}
	if strings.Contains(header, ",") {
		return 0, false, apperrors.New(412, "concurrency.invalid_if_match", "Multiple If-Match values are not supported")
	}
	header = strings.Trim(header, "\"")
	parts := strings.Split(header, ":")
	if len(parts) != 4 || parts[0] != "gapak" || parts[1] == "" || parts[3] == "" {
		return 0, false, apperrors.New(412, "concurrency.invalid_if_match", "Invalid If-Match value")
	}
	rev, err := strconv.ParseInt(parts[2], 10, 64)
	if err != nil || rev < 1 {
		return 0, false, apperrors.New(412, "concurrency.invalid_if_match", "Invalid If-Match revision")
	}
	return rev, true, nil
}

func ETag(resourceType, resourceID string, revision int64, secret string) string {
	unsigned := fmt.Sprintf("gapak:%s:%d:%s", resourceType, revision, resourceID)
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(unsigned))
	sig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil)[:12])
	return fmt.Sprintf("\"gapak:%s:%d:%s:%s\"", resourceType, revision, resourceID, sig)
}

func (s *Store) GetRevision(ctx context.Context, resourceType, resourceID string) (int64, error) {
	var revision int64
	err := s.db.QueryRow(ctx, `SELECT revision FROM entity_versions WHERE resource_type=$1 AND entity_id=$2`, resourceType, resourceID).Scan(&revision)
	if err != nil {
		if err == pgx.ErrNoRows {
			return 0, apperrors.ErrNotFound
		}
		return 0, err
	}
	return revision, nil
}

func (s *Store) GetRevisionTx(ctx context.Context, tx pgx.Tx, resourceType, resourceID string) (int64, error) {
	var revision int64
	err := tx.QueryRow(ctx, `SELECT revision FROM entity_versions WHERE resource_type=$1 AND entity_id=$2 FOR UPDATE`, resourceType, resourceID).Scan(&revision)
	if err != nil {
		if err == pgx.ErrNoRows {
			return 0, apperrors.ErrNotFound
		}
		return 0, err
	}
	return revision, nil
}

func (s *Store) GuardTx(ctx context.Context, tx pgx.Tx, resourceType, resourceID string) error {
	expected, hasExpected := ExpectedRevision(ctx)
	if !hasExpected {
		return nil
	}
	current, err := s.GetRevisionTx(ctx, tx, resourceType, resourceID)
	if err != nil {
		return err
	}
	if current != expected {
		err := apperrors.New(412, "concurrency.version_conflict", "The resource was modified by another request")
		details := map[string]any{"currentVersion": current}
		if secret, ok := ctx.Value(secretKey).(string); ok && secret != "" {
			details["currentETag"] = ETag(resourceType, resourceID, current, secret)
		}
		err.Details = details
		return err
	}
	return nil
}
