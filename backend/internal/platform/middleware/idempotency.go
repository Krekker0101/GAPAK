package middleware

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"

	apperrors "github.com/gapak/backend/internal/platform/errors"
)

const idempotencyTTL = 5 * time.Minute

// Idempotency reserves a client supplied key atomically in Redis. The previous
// EXISTS + SET implementation had a TOCTOU race where concurrent requests could
// both observe a missing key and proceed.
func Idempotency(redisClient *redis.Client) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if c.Method() == fiber.MethodGet || c.Method() == fiber.MethodHead {
			return c.Next()
		}

		key := strings.TrimSpace(c.Get("X-Idempotency-Key"))
		if key == "" {
			return c.Next()
		}
		if len(key) > 128 {
			return apperrors.New(400, "idempotency.invalid_key", "Idempotency key is too long")
		}
		if redisClient == nil {
			return apperrors.New(503, "idempotency.unavailable", "Idempotency protection is unavailable")
		}

		ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
		defer cancel()

		// Bind the key to the operation and caller so an attacker cannot pre-claim
		// a globally shared idempotency key and cause another endpoint/user to
		// receive a false replay response.
		identity := strings.Join([]string{c.Method(), c.Path(), c.IP(), key}, "|")
		digest := sha256.Sum256([]byte(identity))
		redisKey := "idempotent:" + hex.EncodeToString(digest[:])
		claimed, err := redisClient.SetNX(ctx, redisKey, "inflight", idempotencyTTL).Result()
		if err != nil {
			return apperrors.New(503, "idempotency.unavailable", "Idempotency protection is unavailable")
		}
		if !claimed {
			return apperrors.New(409, "idempotency.replay", "Request with this idempotency key has already been processed")
		}

		err = c.Next()
		if err != nil || c.Response().StatusCode() >= 500 {
			// A failed request must not poison its key for the full TTL. If the
			// process crashes, the short TTL still guarantees eventual recovery.
			cleanupCtx, cleanupCancel := context.WithTimeout(context.Background(), 250*time.Millisecond)
			_ = redisClient.Del(cleanupCtx, redisKey).Err()
			cleanupCancel()
			return err
		}
		_ = redisClient.Set(ctx, redisKey, "completed", idempotencyTTL).Err()
		return nil
	}
}
