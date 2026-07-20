package ratelimit

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog"
)

// Service handles rate limiting using token bucket algorithm
type Service struct {
	redis  *redis.Client
	logger *zerolog.Logger
}

// NewService creates a new rate limit service
func NewService(redis *redis.Client, logger *zerolog.Logger) *Service {
	return &Service{
		redis:  redis,
		logger: logger,
	}
}

// Allow checks if a request is allowed under the rate limit
func (s *Service) Allow(ctx context.Context, identifier, resource string, limit int, window time.Duration) bool {
	key := s.getKey(identifier, resource)

	// Use Redis INCR and EXPIRE for token bucket
	pipe := s.redis.Pipeline()

	// Increment counter
	incrCmd := pipe.Incr(ctx, key)

	// Set expiration if this is the first request
	pipe.Expire(ctx, key, window)

	if _, err := pipe.Exec(ctx); err != nil {
		s.logger.Error().Err(err).
			Str("identifier", identifier).
			Str("resource", resource).
			Msg("failed to check rate limit")
		return true // Fail open on error
	}

	count := incrCmd.Val()

	// Check if limit exceeded
	if count > int64(limit) {
		s.logger.Debug().
			Str("identifier", identifier).
			Str("resource", resource).
			Int64("count", count).
			Int("limit", limit).
			Msg("rate limit exceeded")
		return false
	}

	return true
}

// GetRemaining returns the number of requests remaining
func (s *Service) GetRemaining(ctx context.Context, identifier, resource string, limit int) (int, error) {
	key := s.getKey(identifier, resource)

	count, err := s.redis.Get(ctx, key).Int64()
	if err != nil {
		if err == redis.Nil {
			return limit, nil
		}
		return 0, err
	}

	remaining := limit - int(count)
	if remaining < 0 {
		remaining = 0
	}

	return remaining, nil
}

// Reset resets the rate limit counter
func (s *Service) Reset(ctx context.Context, identifier, resource string) error {
	key := s.getKey(identifier, resource)
	return s.redis.Del(ctx, key).Err()
}

// getKey returns the Redis key for rate limiting
func (s *Service) getKey(identifier, resource string) string {
	return fmt.Sprintf("ratelimit:%s:%s", identifier, resource)
}
