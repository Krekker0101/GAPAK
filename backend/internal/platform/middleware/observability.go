package middleware

import (
	"github.com/gapak/backend/internal/platform/observability"
	"github.com/gofiber/fiber/v2"
	"strings"
)

func ObservabilityContext() fiber.Handler {
	return func(c *fiber.Ctx) error {
		requestID := c.GetRespHeader(fiber.HeaderXRequestID)
		if requestID == "" {
			requestID = c.Get(fiber.HeaderXRequestID)
		}
		correlation := observability.ValidExternalID(c.Get("X-Correlation-ID"))
		if correlation == "" {
			correlation = requestID
		}
		traceID := observability.ValidExternalID(c.Get("X-Trace-ID"))
		if traceID == "" {
			traceID = observability.NewID(16)
		}
		c.Set("X-Correlation-ID", correlation)
		c.Set("X-Trace-ID", traceID)
		c.SetUserContext(observability.WithTrace(c.UserContext(), traceID, correlation))
		c.Locals("trace_id", traceID)
		c.Locals("correlation_id", correlation)
		return c.Next()
	}
}

func routeLabel(c *fiber.Ctx) string {
	if r := c.Route(); r != nil && strings.TrimSpace(r.Path) != "" {
		return r.Path
	}
	return c.Path()
}
