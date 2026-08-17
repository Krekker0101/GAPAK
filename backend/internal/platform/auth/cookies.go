package auth

import (
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"

	"github.com/gapak/backend/internal/config"
)

const AccessCookieName = "gapak_at"

func SetAccessCookie(c *fiber.Ctx, cfg config.SecurityConfig, token string, expiresAt time.Time) {
	c.Cookie(&fiber.Cookie{
		Name:     AccessCookieName,
		Value:    token,
		Path:     "/",
		HTTPOnly: true,
		Secure:   cfg.CookieSecure,
		SameSite: parseSameSite(cfg.CookieSameSite),
		Domain:   cookieDomain(cfg.CookieDomain),
		Expires:  expiresAt,
	})
}

func SetRefreshCookie(c *fiber.Ctx, cfg config.SecurityConfig, token string, expiresAt time.Time) {
	c.Cookie(&fiber.Cookie{
		Name:     cfg.RefreshCookieName,
		Value:    token,
		Path:     "/api/v1/auth",
		HTTPOnly: true,
		Secure:   cfg.CookieSecure,
		SameSite: parseSameSite(cfg.CookieSameSite),
		Domain:   cookieDomain(cfg.CookieDomain),
		Expires:  expiresAt,
	})
}

func ClearAuthCookies(c *fiber.Ctx, cfg config.SecurityConfig) {
	expiredAt := time.Now().Add(-time.Hour)
	c.Cookie(&fiber.Cookie{
		Name:     cfg.RefreshCookieName,
		Value:    "",
		Path:     "/api/v1/auth",
		HTTPOnly: true,
		Secure:   cfg.CookieSecure,
		SameSite: parseSameSite(cfg.CookieSameSite),
		Domain:   cookieDomain(cfg.CookieDomain),
		Expires:  expiredAt,
	})
	// Also clear the access token cookie
	c.Cookie(&fiber.Cookie{
		Name:     AccessCookieName,
		Value:    "",
		Path:     "/",
		HTTPOnly: true,
		Secure:   cfg.CookieSecure,
		SameSite: parseSameSite(cfg.CookieSameSite),
		Domain:   cookieDomain(cfg.CookieDomain),
		Expires:  expiredAt,
	})
}

func parseSameSite(raw string) string {
	switch raw {
	case "strict":
		return fiber.CookieSameSiteStrictMode
	case "none":
		return fiber.CookieSameSiteNoneMode
	default:
		return fiber.CookieSameSiteLaxMode
	}
}

func CookieDomain(raw string) string {
	domain := strings.TrimSpace(raw)
	if domain == "" || strings.EqualFold(domain, "localhost") || domain == "127.0.0.1" || domain == "::1" {
		return ""
	}
	return domain
}

func cookieDomain(raw string) string {
	return CookieDomain(raw)
}
