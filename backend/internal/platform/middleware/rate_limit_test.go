package middleware

import (
	"fmt"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"

	"github.com/gapak/backend/internal/platform/httpx"
	"github.com/gapak/backend/internal/platform/logger"
)

func TestRateLimiterFallsBackToInMemoryWhenRedisUnavailable(t *testing.T) {
	t.Parallel()

	app := fiber.New(fiber.Config{
		ErrorHandler: httpx.FiberErrorHandler(logger.New("test")),
	})

	limiter := RateLimiter{
		Redis:  nil,
		Prefix: fmt.Sprintf("test:rate:%d", time.Now().UnixNano()),
		Max:    2,
		Window: time.Minute,
		KeyFn: func(c *fiber.Ctx) string {
			return "same-client"
		},
	}

	app.Use(limiter.Handler())
	app.Get("/", func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusOK)
	})

	for attempt := 1; attempt <= 3; attempt++ {
		req := httptest.NewRequest(fiber.MethodGet, "/", nil)
		resp, err := app.Test(req, 10_000)
		if err != nil {
			t.Fatalf("request %d failed: %v", attempt, err)
		}

		expectedStatus := fiber.StatusOK
		if attempt == 3 {
			expectedStatus = fiber.StatusTooManyRequests
		}
		if resp.StatusCode != expectedStatus {
			t.Fatalf("request %d expected status %d, got %d", attempt, expectedStatus, resp.StatusCode)
		}
	}
}
