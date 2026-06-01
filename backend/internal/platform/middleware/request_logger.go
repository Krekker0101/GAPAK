package middleware

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog"

	apperrors "github.com/gapak/backend/internal/platform/errors"
	"github.com/gapak/backend/internal/platform/privacy"
)

func RequestLogger(logger zerolog.Logger, privacyService *privacy.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		startedAt := time.Now()
		err := c.Next()
		latency := time.Since(startedAt)
		status := c.Response().StatusCode()
		if err != nil {
			status = apperrors.As(err).Status
		}

		event := logger.Info().
			Str("request_id", c.GetRespHeader(fiber.HeaderXRequestID)).
			Str("method", c.Method()).
			Str("path", c.Path()).
			Int("status", status).
			Dur("latency", latency)
		if status >= fiber.StatusInternalServerError {
			event = logger.Error().
				Str("request_id", c.GetRespHeader(fiber.HeaderXRequestID)).
				Str("method", c.Method()).
				Str("path", c.Path()).
				Int("status", status).
				Dur("latency", latency)
		} else if status >= fiber.StatusBadRequest {
			event = logger.Warn().
				Str("request_id", c.GetRespHeader(fiber.HeaderXRequestID)).
				Str("method", c.Method()).
				Str("path", c.Path()).
				Int("status", status).
				Dur("latency", latency)
		}
		if privacyService != nil {
			if clientHint := privacyService.LogClientHint(c); clientHint != "" {
				event = event.Str("client_hint", clientHint)
			}
		} else {
			event = event.Str("ip", c.IP())
		}
		event.Msg("http_request")

		return err
	}
}
