package middleware

import (
	"crypto/subtle"

	"github.com/gofiber/fiber/v2"

	"github.com/gapak/backend/internal/config"
	apperrors "github.com/gapak/backend/internal/platform/errors"
)

func ValidateCSRF(cfg config.SecurityConfig) fiber.Handler {
	return func(c *fiber.Ctx) error {
		cookieValue := c.Cookies(cfg.CSRFCookieName)
		headerValue := c.Get("X-CSRF-Token")
		if cookieValue == "" || headerValue == "" {
			return apperrors.ErrCSRFInvalid
		}
		if subtle.ConstantTimeCompare([]byte(cookieValue), []byte(headerValue)) != 1 {
			return apperrors.ErrCSRFInvalid
		}
		return c.Next()
	}
}

func ValidateCSRFForMutations(cfg config.SecurityConfig) fiber.Handler {
	return func(c *fiber.Ctx) error {
		headerValue := c.Get("X-CSRF-Token")
		if headerValue == "" {
			return apperrors.ErrCSRFInvalid
		}
		cookieValue := c.Cookies(cfg.CSRFCookieName)
		// Double-submit CSRF requires both values. The /auth/csrf endpoint
		// issues the cookie before any state-changing unauthenticated request.
		// Accepting an arbitrary header without a cookie would make the middleware
		// a presence check rather than a CSRF defense.
		if cookieValue == "" || subtle.ConstantTimeCompare([]byte(cookieValue), []byte(headerValue)) != 1 {
			return apperrors.ErrCSRFInvalid
		}
		return c.Next()
	}
}
