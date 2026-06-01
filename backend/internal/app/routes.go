package app

import (
	"context"
	"time"

	"github.com/gofiber/fiber/v2"

	apperrors "github.com/gapak/backend/internal/platform/errors"
	"github.com/gapak/backend/internal/platform/httpx"
)

func registerBaseRoutes(app *fiber.App, deps Dependencies) {
	app.Get("/api/openapi.yaml", func(c *fiber.Ctx) error {
		return c.SendFile("./docs/openapi.yaml")
	})

	app.Get("/health/live", func(c *fiber.Ctx) error {
		return c.JSON(httpx.OK(map[string]string{"status": "ok"}, c.GetRespHeader(fiber.HeaderXRequestID), nil))
	})

	app.Get("/health/ready", func(c *fiber.Ctx) error {
		ctx, cancel := context.WithTimeout(c.UserContext(), 2*time.Second)
		defer cancel()

		status := "ready"
		mode := "full"
		dependencies := map[string]map[string]any{
			"postgres": {
				"status":   "up",
				"critical": true,
			},
			"redis": {
				"status":   "up",
				"critical": false,
			},
		}

		if deps.DB != nil {
			if err := deps.DB.Ping(ctx); err != nil {
				return apperrors.WithDetails(apperrors.New(fiber.StatusServiceUnavailable, "health.postgres_unavailable", "PostgreSQL is unavailable"), map[string]any{
					"reason": err.Error(),
				})
			}
		}

		if deps.Redis == nil {
			status = "degraded"
			mode = "database-fallback"
			dependencies["redis"]["status"] = "down"
			dependencies["redis"]["optional"] = true
			dependencies["redis"]["reason"] = "redis client is not configured or unavailable during startup"
		} else if err := deps.Redis.Ping(ctx).Err(); err != nil {
			status = "degraded"
			mode = "database-fallback"
			dependencies["redis"]["status"] = "down"
			dependencies["redis"]["optional"] = true
			dependencies["redis"]["reason"] = err.Error()
		} else {
			dependencies["redis"]["optional"] = true
		}

		return c.JSON(httpx.OK(map[string]any{
			"status":       status,
			"mode":         mode,
			"dependencies": dependencies,
			"timestamp":    time.Now().UTC(),
		}, c.GetRespHeader(fiber.HeaderXRequestID), nil))
	})
}
