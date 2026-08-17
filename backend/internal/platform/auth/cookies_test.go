package auth

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gapak/backend/internal/config"
	"github.com/gofiber/fiber/v2"
)

func TestAuthCookiesNeverSetCSRF(t *testing.T) {
	cfg := config.SecurityConfig{RefreshCookieName: "gapak_rt", CookieSecure: true, CookieSameSite: "none", CookieDomain: ""}
	app := fiber.New()
	app.Get("/cookies", func(c *fiber.Ctx) error {
		SetAccessCookie(c, cfg, "access", time.Now().Add(time.Hour))
		SetRefreshCookie(c, cfg, "refresh", time.Now().Add(time.Hour))
		return c.SendStatus(fiber.StatusNoContent)
	})
	resp, err := app.Test(httptest.NewRequest(http.MethodGet, "/cookies", nil))
	if err != nil {
		t.Fatal(err)
	}
	cookies := resp.Header.Values("Set-Cookie")
	if len(cookies) != 2 {
		t.Fatalf("expected 2 auth cookies, got %d: %v", len(cookies), cookies)
	}
	for _, cookie := range cookies {
		if strings.Contains(cookie, "gapak_csrf") {
			t.Fatalf("CSRF cookie must not be emitted: %s", cookie)
		}
	}
}

func TestClearAuthCookiesDoesNotClearCSRF(t *testing.T) {
	cfg := config.SecurityConfig{RefreshCookieName: "gapak_rt", CookieSecure: true, CookieSameSite: "none"}
	app := fiber.New()
	app.Get("/logout", func(c *fiber.Ctx) error {
		ClearAuthCookies(c, cfg)
		return c.SendStatus(fiber.StatusNoContent)
	})
	resp, err := app.Test(httptest.NewRequest(http.MethodGet, "/logout", nil))
	if err != nil {
		t.Fatal(err)
	}
	for _, cookie := range resp.Header.Values("Set-Cookie") {
		if strings.Contains(cookie, "gapak_csrf") {
			t.Fatalf("CSRF cookie must not be cleared/emitted: %s", cookie)
		}
	}
}
