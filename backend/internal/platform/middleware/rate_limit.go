package middleware

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"

	apperrors "github.com/gapak/backend/internal/platform/errors"
	"github.com/gapak/backend/internal/platform/observability"
)

type RateLimiter struct {
	Redis   *redis.Client
	Prefix  string
	Max     int64
	Window  time.Duration
	KeyFn   func(*fiber.Ctx) string
	Metrics *observability.Registry
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

var distributedRateLimitScript = redis.NewScript(`
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("EXPIRE", KEYS[1], ARGV[1])
end
return current
`)

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
		redisHealthy := false
		if l.Redis != nil {
			windowSeconds := int64(l.Window / time.Second)
			if windowSeconds < 1 {
				windowSeconds = 1
			}
			ctx, cancel := context.WithTimeout(context.Background(), 250*time.Millisecond)
			redisCounter, err := distributedRateLimitScript.Run(ctx, l.Redis, []string{key}, windowSeconds).Int64()
			cancel()
			if err == nil {
				redisHealthy = true
				counter = redisCounter
			}
		}

		// Authentication and password endpoints must not silently lose their
		// distributed rate limit when Redis is unavailable. Non-critical traffic
		// can still degrade to the process-local limiter for availability.
		if isCriticalEndpoint(c.Path()) && !redisHealthy {
			return apperrors.New(503, "rate_limiter.unavailable", "Rate limiting unavailable")
		}
		if !redisHealthy {
			counter = fallbackRateLimitStore.Incr(key, l.Window, time.Now().UTC())
		}

		if counter > l.Max {
			if l.Metrics != nil {
				l.Metrics.RateLimitEvents.Inc(observability.Label("prefix", l.Prefix))
			}
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
		"/api/v1/auth/register-anonymous",
		"/api/v1/auth/login",
		"/api/v1/auth/refresh",
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
