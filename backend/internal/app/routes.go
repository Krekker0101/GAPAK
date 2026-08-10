package app

import (
	"context"
	"time"

	"github.com/gofiber/fiber/v2"

	apperrors "github.com/gapak/backend/internal/platform/errors"
	"github.com/gapak/backend/internal/platform/httpx"
	"github.com/gapak/backend/internal/platform/observability"
)

func registerBaseRoutes(app *fiber.App, deps Dependencies) {
	app.Get("/metrics", func(c *fiber.Ctx) error {
		c.Set(fiber.HeaderContentType, "text/plain; version=0.0.4; charset=utf-8")
		if !deps.Config.Metrics.Enabled || deps.Observability == nil {
			return c.SendStatus(fiber.StatusNotFound)
		}
		if deps.Config.Metrics.Token != "" && c.Get("Authorization") != "Bearer "+deps.Config.Metrics.Token {
			return c.SendStatus(fiber.StatusUnauthorized)
		}
		return c.Send(deps.Observability.Render())
	})
	app.Get("/api/openapi.yaml", func(c *fiber.Ctx) error {
		return c.SendFile("./docs/openapi.yaml")
	})

	app.Get("/health/live", func(c *fiber.Ctx) error {
		return c.JSON(httpx.OK(map[string]string{"status": "ok"}, c.GetRespHeader(fiber.HeaderXRequestID), nil))
	})

	app.Get("/health/ready", func(c *fiber.Ctx) error {
		ctx, cancel := context.WithTimeout(c.UserContext(), 2*time.Second)
		defer cancel()

		dependencies := map[string]map[string]any{
			"postgres": {
				"status":   "up",
				"critical": true,
			},
			"redis": {
				"status":   "up",
				"critical": deps.Config.Redis.Enabled,
			},
		}
		mode := "full"

		if deps.DB != nil {
			if err := deps.DB.Ping(ctx); err != nil {
				return apperrors.New(fiber.StatusServiceUnavailable, "health.postgres_unavailable", "PostgreSQL is unavailable")
			}
		}

		if !deps.Config.Redis.Enabled {
			dependencies["redis"]["status"] = "disabled"
			dependencies["redis"]["reason"] = "redis is disabled via REDIS_ENABLED=false"
			mode = "database-fallback"
		} else if deps.Redis == nil {
			dependencies["redis"]["status"] = "down"
			dependencies["redis"]["reason"] = "redis client is not configured or unavailable during startup"
			mode = "database-fallback"
		} else if err := deps.Redis.Ping(ctx).Err(); err != nil {
			dependencies["redis"]["status"] = "down"
			dependencies["redis"]["reason"] = "dependency unavailable"
			mode = "database-fallback"
		}

		if dependencies["redis"]["critical"].(bool) && dependencies["redis"]["status"] != "up" {
			return c.Status(fiber.StatusServiceUnavailable).JSON(httpx.OK(map[string]any{
				"status":        "unavailable",
				"mode":          mode,
				"dependencies":  dependencies,
				"timestamp":     time.Now().UTC(),
				"postgres_pool": poolSnapshot(deps.Observability),
			}, c.GetRespHeader(fiber.HeaderXRequestID), nil))
		}

		return c.JSON(httpx.OK(map[string]any{
			"status":        "ready",
			"mode":          mode,
			"dependencies":  dependencies,
			"timestamp":     time.Now().UTC(),
			"postgres_pool": poolSnapshot(deps.Observability),
		}, c.GetRespHeader(fiber.HeaderXRequestID), nil))
	})
}

func poolSnapshot(obs *observability.Registry) map[string]any {
	if obs == nil {
		return nil
	}
	s := obs.DBStats()
	return map[string]any{"total": s.TotalConns, "idle": s.IdleConns, "acquired": s.AcquiredConns, "max": s.MaxConns}
}
