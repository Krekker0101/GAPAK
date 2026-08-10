package middleware

import (
	"strconv"

	"github.com/gofiber/fiber/v2"
)

func SecurityHeaders(hstsMaxAge int) fiber.Handler {
	return func(c *fiber.Ctx) error {
		c.Set(fiber.HeaderStrictTransportSecurity, hstsDirective(hstsMaxAge))
		c.Set("X-Content-Type-Options", "nosniff")
		c.Set("X-Frame-Options", "DENY")
		c.Set("Referrer-Policy", "strict-origin-when-cross-origin")
		c.Set("Permissions-Policy", "geolocation=(), microphone=(), camera=(), payment=()")
		return c.Next()
	}
}

func hstsDirective(maxAge int) string {
	if maxAge <= 0 {
		return "max-age=0"
	}
	return "max-age=" + strconv.Itoa(maxAge) + "; includeSubDomains; preload"
}
