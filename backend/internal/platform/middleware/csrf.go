package middleware

import (
	"crypto/subtle"
	"strings"

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

func ValidateCSRFForMutations(cfg config.SecurityConfig, allowedOrigins ...string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		headerValue := c.Get("X-CSRF-Token")
		if headerValue == "" {
			return apperrors.ErrCSRFInvalid
		}
		cookieValue := c.Cookies(cfg.CSRFCookieName)
		// Prefer the strict double-submit-cookie check whenever the browser can
		// send the CSRF cookie. Cross-site SPA deployments such as Vercel ->
		// Railway can legitimately have third-party-cookie restrictions, however.
		// In that case the custom X-CSRF-Token header is still a browser-enforced
		// CORS preflight boundary. Accept it only when the request Origin exactly
		// matches an explicitly configured application origin; never accept a
		// header-only token from an unknown origin.
		if cookieValue != "" {
			if subtle.ConstantTimeCompare([]byte(cookieValue), []byte(headerValue)) != 1 {
				return apperrors.ErrCSRFInvalid
			}
			return c.Next()
		}
		origin := c.Get("Origin")
		if origin == "" || !isAllowedOrigin(origin, allowedOrigins) {
			return apperrors.ErrCSRFInvalid
		}
		return c.Next()
	}
}

func isAllowedOrigin(origin string, allowedOrigins []string) bool {
	origin = strings.TrimRight(strings.TrimSpace(origin), "/")
	if origin == "" {
		return false
	}
	for _, allowed := range allowedOrigins {
		if strings.EqualFold(origin, strings.TrimRight(strings.TrimSpace(allowed), "/")) {
			return true
		}
	}
	return false
}
