package middleware

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"

	apperrors "github.com/gapak/backend/internal/platform/errors"
)

type RateLimiter struct {
	Redis  *redis.Client
	Prefix string
	Max    int64
	Window time.Duration
	KeyFn  func(*fiber.Ctx) string
}

type localRateLimitWindow struct {
	Count     int64
	ExpiresAt time.Time
}

type localRateLimitStore struct {
	mu       sync.Mutex
	counters map[string]localRateLimitWindow
	ops      uint64
}

var fallbackRateLimitStore = &localRateLimitStore{
	counters: map[string]localRateLimitWindow{},
}

func (l RateLimiter) Handler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if l.Max <= 0 || l.Window <= 0 {
			return c.Next()
		}

		keyFn := l.KeyFn
		if keyFn == nil {
			keyFn = func(c *fiber.Ctx) string { return c.IP() }
		}

		key := fmt.Sprintf("%s:%s", l.Prefix, keyFn(c))

		counter := int64(0)
		if l.Redis != nil {
			ctx, cancel := context.WithTimeout(context.Background(), 250*time.Millisecond)
			redisCounter, err := l.Redis.Incr(ctx, key).Result()
			cancel()
			if err == nil {
				counter = redisCounter
				if counter == 1 {
					_ = l.Redis.Expire(context.Background(), key, l.Window).Err()
				}
			}
		}
		if counter == 0 {
			counter = fallbackRateLimitStore.Incr(key, l.Window, time.Now().UTC())
		}

		// For critical endpoints, fail closed if Redis is unavailable and we hit fallback
		if l.Redis == nil && isCriticalEndpoint(c.Path()) && counter > l.Max {
			return apperrors.New(503, "rate_limiter.unavailable", "Rate limiting unavailable")
		}

		if counter > l.Max {
			return apperrors.WithDetails(apperrors.ErrRateLimited, map[string]any{
				"limit":  l.Max,
				"window": l.Window.String(),
			})
		}
		return c.Next()
	}
}

func isCriticalEndpoint(path string) bool {
	criticalPaths := []string{
		"/api/v1/auth/register",
		"/api/v1/auth/login",
		"/api/v1/auth/forgot-password",
		"/api/v1/auth/reset-password",
	}
	for _, p := range criticalPaths {
		if path == p {
			return true
		}
	}
	return false
}

func (s *localRateLimitStore) Incr(key string, window time.Duration, now time.Time) int64 {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.ops++
	if s.ops%512 == 0 {
		for existingKey, existingWindow := range s.counters {
			if !now.Before(existingWindow.ExpiresAt) {
				delete(s.counters, existingKey)
			}
		}
	}

	current, exists := s.counters[key]
	if !exists || !now.Before(current.ExpiresAt) {
		current = localRateLimitWindow{
			Count:     0,
			ExpiresAt: now.Add(window),
		}
	}
	current.Count++
	s.counters[key] = current
	return current.Count
}
