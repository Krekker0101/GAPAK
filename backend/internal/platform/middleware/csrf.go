package middleware

import (
	"crypto/subtle"
	"net/url"
	"strings"

	auth "github.com/gapak/backend/internal/platform/auth"

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
		if !isSafeMethod(c.Method()) {
			origin := strings.TrimSpace(c.Get("Origin"))
			if origin != "" {
				if !isAllowedOrigin(origin, allowedOrigins) {
					return apperrors.ErrCSRFInvalid
				}
			} else if ref := strings.TrimSpace(c.Get("Referer")); ref != "" {
				if !refererMatchesAllowedOrigin(ref, allowedOrigins) {
					return apperrors.ErrCSRFInvalid
				}
			} else if c.Cookies(auth.AccessCookieName) != "" || c.Cookies(cfg.RefreshCookieName) != "" {
				// Cookie-authenticated browser mutations without Origin/Referer are
				// ambiguous and must not be accepted as CSRF-safe. Token-authenticated
				// non-browser clients can use Authorization without these headers.
				if strings.TrimSpace(c.Get("Authorization")) == "" {
					return apperrors.ErrCSRFInvalid
				}
			}
		}
		headerValue := c.Get("X-CSRF-Token")
		if headerValue == "" {
			return apperrors.ErrCSRFInvalid
		}
		cookieValue := c.Cookies(cfg.CSRFCookieName)
		// Browser mutations use strict double-submit CSRF protection: the token
		// must be present in both the readable cookie and the custom header.
		// CORS origin validation remains a separate browser-origin boundary.
		if cookieValue == "" {
			return apperrors.ErrCSRFInvalid
		}
		if subtle.ConstantTimeCompare([]byte(cookieValue), []byte(headerValue)) != 1 {
			return apperrors.ErrCSRFInvalid
		}
		return c.Next()
	}
}

func BrowserMutationCSRF(cfg config.SecurityConfig, allowedOrigins ...string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if isSafeMethod(c.Method()) {
			return c.Next()
		}
		if c.Get("Origin") == "" && c.Get("Referer") == "" && c.Cookies(auth.AccessCookieName) == "" && c.Cookies(cfg.RefreshCookieName) == "" {
			// Explicit bearer-token/server-to-server clients do not need browser CSRF.
			return c.Next()
		}
		return ValidateCSRFForMutations(cfg, allowedOrigins...)(c)
	}
}

func isSafeMethod(method string) bool {
	switch strings.ToUpper(method) {
	case "GET", "HEAD", "OPTIONS":
		return true
	default:
		return false
	}
}

func refererMatchesAllowedOrigin(raw string, allowedOrigins []string) bool {
	ref := strings.TrimSpace(raw)
	if ref == "" {
		return false
	}
	u, err := url.Parse(ref)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return false
	}
	return isAllowedOrigin(u.Scheme+"://"+u.Host, allowedOrigins)
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
