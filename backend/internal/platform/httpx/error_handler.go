package httpx

import (
	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog"

	apperrors "github.com/gapak/backend/internal/platform/errors"
)

func FiberErrorHandler(logger zerolog.Logger) fiber.ErrorHandler {
	return func(c *fiber.Ctx, err error) error {
		appErr := apperrors.As(err)
		requestID := c.GetRespHeader(fiber.HeaderXRequestID)
		if requestID == "" {
			requestID = c.Get(fiber.HeaderXRequestID)
		}

		event := logger.Error().
			Str("request_id", requestID).
			Str("path", c.Path()).
			Str("method", c.Method()).
			Int("status", appErr.Status).
			Str("code", appErr.Code)

		if appErr.Cause != nil {
			event = event.Err(appErr.Cause)
		}

		event.Msg(appErr.Message)

		return c.Status(appErr.Status).JSON(ErrorEnvelope(appErr, requestID))
	}
}
