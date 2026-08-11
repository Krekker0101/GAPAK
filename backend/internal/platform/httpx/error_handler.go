package httpx

import (
	stderrors "errors"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog"

	logsanitize "github.com/gapak/backend/internal/platform/logger"

	apperrors "github.com/gapak/backend/internal/platform/errors"
)

func FiberErrorHandler(logger zerolog.Logger) fiber.ErrorHandler {
	return func(c *fiber.Ctx, err error) error {
		appErr := apperrors.As(err)
		var fiberErr *fiber.Error
		if stderrors.As(err, &fiberErr) {
			appErr = apperrors.Wrap(err, fiberErr.Code, fiberErrorCode(fiberErr.Code), fiberErr.Message)
		}
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
			event = event.Str("cause", logsanitize.Sanitize(appErr.Cause.Error()))
		}

		event.Msg(appErr.Message)

		return c.Status(appErr.Status).JSON(ErrorEnvelope(appErr, requestID))
	}
}

func fiberErrorCode(status int) string {
	switch status {
	case fiber.StatusNotFound:
		return "http.not_found"
	case fiber.StatusMethodNotAllowed:
		return "http.method_not_allowed"
	default:
		return "http.error"
	}
}
