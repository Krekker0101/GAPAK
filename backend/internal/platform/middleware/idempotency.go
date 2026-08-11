package middleware

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9
)

const idempotencyTTL = 5 * time.Minute

// Idempotency reserves a client supplied key atomically in Redis. When Redis
// is unavailable, the request continues without distributed deduplication:
// idempotency is a safety optimization and must not make login/register
// unavailable on a deployment that intentionally runs without Redis.
func Idempotency(redisClient *redis.Client) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if c.Method() == fiber.MethodGet || c.Method() == fiber.MethodHead {
			return c.Next()
		}

		key := strings.TrimSpace(c.Get("X-Idempotency-Key"))
		if key == "" || redisClient == nil {
			return c.Next()
		}
		if len(key) > 128 {
			return fiber.NewError(fiber.StatusBadRequest, "Idempotency key is too long")
		}

		ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
		defer cancel()

		identity := strings.Join([]string{c.Method(), c.Path(), c.IP(), key}, "|")
		digest := sha256.Sum256([]byte(identity))
		redisKey := "idempotent:" + hex.EncodeToString(digest[:])
		claimed, err := redisClient.SetNX(ctx, redisKey, "inflight", idempotencyTTL).Result()
		if err != nil {
			return c.Next()
		}
		if !claimed {
			return fiber.NewError(fiber.StatusConflict, "Request with this idempotency key has already been processed")
		}

		err = c.Next()
		if err != nil || c.Response().StatusCode() >= 500 {
			cleanupCtx, cleanupCancel := context.WithTimeout(context.Background(), 250*time.Millisecond)
			_ = redisClient.Del(cleanupCtx, redisKey).Err()
			cleanupCancel()
			return err
		}
		_ = redisClient.Set(ctx, redisKey, "completed", idempotencyTTL).Err()
		return nil
	}
}
