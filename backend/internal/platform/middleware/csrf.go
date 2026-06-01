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
		// For mutations, we validate the header token
		// For authenticated requests, also check cookie if present
		cookieValue := c.Cookies(cfg.CSRFCookieName)
		if cookieValue != "" {
			if subtle.ConstantTimeCompare([]byte(cookieValue), []byte(headerValue)) != 1 {
				return apperrors.ErrCSRFInvalid
			}
		}
		// If no cookie (e.g., for register/login), we still validate header is present
		// Additional validation can be added here if needed
		return c.Next()
	}
}
