package middleware

import (
	apperrors "github.com/gapak/backend/internal/platform/errors"
	"github.com/gapak/backend/internal/platform/observability"
	"github.com/gapak/backend/internal/platform/privacy"
	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog"
	"time"
)

func RequestLogger(logger zerolog.Logger, privacyService *privacy.Service, obs *observability.Registry) fiber.Handler {
	return func(c *fiber.Ctx) error {
		startedAt := time.Now()
		err := c.Next()
		latency := time.Since(startedAt)
		status := c.Response().StatusCode()
		code := ""
		if err != nil {
			appErr := apperrors.As(err)
			status = appErr.Status
			code = appErr.Code
		}
		endpoint := routeLabel(c)
		method := c.Method()
		key := observability.Labels("method", method, "endpoint", endpoint, "status", itoa(status))
		if obs != nil {
			obs.HTTPRequests.Inc(key)
			obs.HTTPLatency.Observe(observability.Label("endpoint", endpoint), latency.Seconds())
			if status >= 400 {
				obs.HTTPErrors.Inc(observability.Label("status", itoa(status)))
			}
		}
		event := logger.Info()
		if status >= 500 {
			event = logger.Error()
		} else if status >= 400 {
			event = logger.Warn()
		}
		event = event.Str("component", "http").Str("operation", method+" "+endpoint).Str("request_id", c.GetRespHeader(fiber.HeaderXRequestID)).Str("trace_id", localString(c, "trace_id")).Str("correlation_id", localString(c, "correlation_id")).Str("method", method).Str("path", endpoint).Int("status", status).Dur("latency", latency)
		if code != "" {
			event = event.Str("error_code", code)
		}
		if claims := ClaimsFromContext(c); claims != nil {
			event = event.Str("user_id", claims.UserID).Str("session_id", claims.SessionID)
		}
		if privacyService != nil {
			if hint := privacyService.LogClientHint(c); hint != "" {
				event = event.Str("client_hint", hint)
			}
		}
		event.Msg("http_request")
		if code != "" {
			recordAuthMetrics(obs, endpoint, status, code)
		}
		return err
	}
}
func localString(c *fiber.Ctx, k string) string {
	if v, ok := c.Locals(k).(string); ok {
		return v
	}
	return ""
}
func itoa(v int) string {
	const digits = "0123456789"
	if v == 0 {
		return "0"
	}
	neg := v < 0
	if neg {
		v = -v
	}
	var b [20]byte
	i := len(b)
	for v > 0 {
		i--
		b[i] = digits[v%10]
		v /= 10
	}
	if neg {
		i--
		b[i] = '-'
	}
	return string(b[i:])
}
func recordAuthMetrics(obs *observability.Registry, endpoint string, status int, code string) {
	if obs == nil {
		return
	}
	if endpoint == "/api/v1/auth/login" && status >= 400 {
		obs.AuthEvents.Inc(observability.Label("event", "login_failure"))
	}
	switch code {
	case "auth.refresh_replay":
		obs.AuthEvents.Inc(observability.Label("event", "refresh_replay"))
	case "auth.account_locked", "auth.login_blocked_locked":
		obs.AuthEvents.Inc(observability.Label("event", "account_lockout"))
	case "auth.two_factor_invalid":
		obs.AuthEvents.Inc(observability.Label("event", "two_factor_failure"))
	}
	if endpoint == "/api/v1/auth/forgot-password" || endpoint == "/api/v1/auth/reset-password" {
		obs.AuthEvents.Inc(observability.Label("event", "password_reset"))
	}
}
