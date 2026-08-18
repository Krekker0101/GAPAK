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
const ifMatchConditionKey contextKey = "gapak.concurrency.if_match"

type ifMatchCondition struct {
	ResourceType string
	ResourceID   string
	Signature    string
	Revision     int64
	Any          bool
}

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
	condition, ok, err := parseIfMatchCondition(header)
	if err != nil || !ok || condition.Any {
		return 0, false, err
	}
	return condition.Revision, true, nil
}

func parseIfMatchCondition(header string) (ifMatchCondition, bool, error) {
	header = strings.TrimSpace(header)
	if header == "" {
		return ifMatchCondition{}, false, nil
	}
	if header == "*" {
		return ifMatchCondition{Any: true}, true, nil
	}
	if strings.Contains(header, ",") {
		return ifMatchCondition{}, false, invalidIfMatch("Multiple If-Match values are not supported")
	}
	if strings.HasPrefix(header, "W/") {
		return ifMatchCondition{}, false, invalidIfMatch("Weak entity tags are not valid for If-Match")
	}
	if len(header) < 2 || header[0] != '"' || header[len(header)-1] != '"' {
		return ifMatchCondition{}, false, invalidIfMatch("If-Match must contain a quoted entity tag")
	}
	header = header[1 : len(header)-1]
	if strings.ContainsRune(header, '"') {
		return ifMatchCondition{}, false, invalidIfMatch("Invalid If-Match value")
	}
	parts := strings.Split(header, ":")
	if len(parts) != 5 || parts[0] != "gapak" || parts[1] == "" || parts[3] == "" || parts[4] == "" {
		return ifMatchCondition{}, false, invalidIfMatch("Invalid If-Match value")
	}
	rev, err := strconv.ParseInt(parts[2], 10, 64)
	if err != nil || rev < 1 {
		return ifMatchCondition{}, false, invalidIfMatch("Invalid If-Match revision")
	}
	signature, err := base64.RawURLEncoding.DecodeString(parts[4])
	if err != nil || len(signature) != 12 {
		return ifMatchCondition{}, false, invalidIfMatch("Invalid If-Match signature")
	}
	return ifMatchCondition{ResourceType: parts[1], Revision: rev, ResourceID: parts[3], Signature: parts[4]}, true, nil
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
	condition, hasCondition := ctx.Value(ifMatchConditionKey).(ifMatchCondition)
	if !hasExpected && !hasCondition {
		return nil
	}
	if hasCondition && !condition.Any {
		secret, ok := ctx.Value(secretKey).(string)
		if !ok || secret == "" || condition.ResourceType != resourceType || condition.ResourceID != resourceID || !validIfMatchSignature(condition, secret) {
			return invalidIfMatch("If-Match does not belong to the target resource")
		}
	}
	current, err := s.GetRevisionTx(ctx, tx, resourceType, resourceID)
	if err != nil {
		return err
	}
	if condition.Any {
		return nil
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

func withIfMatchCondition(ctx context.Context, condition ifMatchCondition) context.Context {
	return context.WithValue(ctx, ifMatchConditionKey, condition)
}

func validIfMatchSignature(condition ifMatchCondition, secret string) bool {
	expected := ETag(condition.ResourceType, condition.ResourceID, condition.Revision, secret)
	actual := fmt.Sprintf("\"gapak:%s:%d:%s:%s\"", condition.ResourceType, condition.Revision, condition.ResourceID, condition.Signature)
	return hmac.Equal([]byte(expected), []byte(actual))
}

func invalidIfMatch(message string) error {
	return apperrors.New(412, "concurrency.invalid_if_match", message)
}
