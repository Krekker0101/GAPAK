package auth

import (
	"context"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"
)

// RevocationChecker verifies whether a token has been revoked and records new
// revocations. A nil checker means revocation is not configured (typically
// because Redis is disabled).
type RevocationChecker interface {
	Revoke(ctx context.Context, jti string, ttl time.Duration) error
	RevokeUser(ctx context.Context, userID string, at time.Time) error
	IsRevoked(ctx context.Context, claims *Claims) (bool, error)
}

// RedisRevocationChecker stores revoked token JTIs and per-user revocation
// timestamps in Redis. Per-user entries expire after the access token TTL,
// because older access tokens are already invalid by then.
type RedisRevocationChecker struct {
	client *redis.Client
	prefix string
}

func NewRedisRevocationChecker(client *redis.Client) *RedisRevocationChecker {
	return &RedisRevocationChecker{client: client, prefix: "token:rev:"}
}

func (r *RedisRevocationChecker) key(suffix string) string {
	return r.prefix + suffix
}

func (r *RedisRevocationChecker) Revoke(ctx context.Context, jti string, ttl time.Duration) error {
	if r.client == nil || jti == "" {
		return nil
	}
	return r.client.Set(ctx, r.key("jti:"+jti), "1", ttl).Err()
}

func (r *RedisRevocationChecker) RevokeUser(ctx context.Context, userID string, at time.Time) error {
	if r.client == nil || userID == "" {
		return nil
	}
	return r.client.Set(ctx, r.key("user:"+userID), strconv.FormatInt(at.Unix(), 10), 0).Err()
}

func (r *RedisRevocationChecker) IsRevoked(ctx context.Context, claims *Claims) (bool, error) {
	if r.client == nil || claims == nil {
		return false, nil
	}

	if claims.ID != "" {
		exists, err := r.client.Exists(ctx, r.key("jti:"+claims.ID)).Result()
		if err != nil {
			return false, err
		}
		if exists > 0 {
			return true, nil
		}
	}

	if claims.UserID == "" {
		return false, nil
	}
	raw, err := r.client.Get(ctx, r.key("user:"+claims.UserID)).Result()
	if err == redis.Nil {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	revokedAt, err := strconv.ParseInt(raw, 10, 64)
	if err != nil {
		return false, err
	}
	if claims.IssuedAt != nil && claims.IssuedAt.Unix() < revokedAt {
		return true, nil
	}
	return false, nil
}
