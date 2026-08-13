package auth

import (
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"

	"github.com/gapak/backend/internal/config"
)

func TestCookiesHonorCrossSiteProductionPolicy(t *testing.T) {
	app := fiber.New()
	cfg := config.SecurityConfig{RefreshCookieName: "gapak_rt", CSRFCookieName: "gapak_csrf", CookieSecure: true, CookieSameSite: "none", CookieDomain: ""}
	app.Get("/", func(c *fiber.Ctx) error {
		SetAccessCookie(c, cfg, "access", time.Now().Add(time.Hour))
		SetRefreshCookie(c, cfg, "refresh", time.Now().Add(24*time.Hour))
		SetCSRFCookie(c, cfg, "csrf", time.Now().Add(time.Hour))
		return nil
	})
	resp, err := app.Test(httptest.NewRequest(fiber.MethodGet, "/", nil), -1)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	cookies := resp.Header.Values("Set-Cookie")
	if len(cookies) != 3 {
		t.Fatalf("expected 3 cookies, got %d", len(cookies))
	}
	for _, cookie := range cookies {
		if !strings.Contains(strings.ToLower(cookie), "secure") {
			t.Fatalf("cookie missing Secure: %s", cookie)
		}
		if !strings.Contains(strings.ToLower(cookie), "samesite=none") {
			t.Fatalf("cookie missing SameSite=None: %s", cookie)
		}
		if strings.Contains(strings.ToLower(cookie), "domain=") {
			t.Fatalf("production host-only cookie unexpectedly has Domain: %s", cookie)
		}
	}
}

func TestCSRFCookieIsReadableByBrowser(t *testing.T) {
	app := fiber.New()
	cfg := config.SecurityConfig{CSRFCookieName: "gapak_csrf", CookieSecure: true, CookieSameSite: "none"}
	app.Get("/", func(c *fiber.Ctx) error {
		SetCSRFCookie(c, cfg, "csrf-token", time.Now().Add(time.Hour))
		return nil
	})
	resp, err := app.Test(httptest.NewRequest(fiber.MethodGet, "/", nil), -1)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	joined := strings.Join(resp.Header.Values("Set-Cookie"), "\n")
	if strings.Contains(strings.ToLower(joined), "httponly") {
		t.Fatalf("CSRF cookie must be readable by browser JavaScript: %s", joined)
	}
}

func TestClearAuthCookiesUsesConfiguredSameSiteForAccessCookie(t *testing.T) {
	app := fiber.New()
	cfg := config.SecurityConfig{RefreshCookieName: "gapak_rt", CSRFCookieName: "gapak_csrf", CookieSecure: true, CookieSameSite: "none"}
	app.Get("/", func(c *fiber.Ctx) error { ClearAuthCookies(c, cfg); return nil })
	resp, err := app.Test(httptest.NewRequest(fiber.MethodGet, "/", nil), -1)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	joined := strings.Join(resp.Header.Values("Set-Cookie"), "\n")
	if !strings.Contains(strings.ToLower(joined), "gapak_at=") || !strings.Contains(strings.ToLower(joined), "samesite=none") {
		t.Fatalf("access cookie was not cleared with configured attributes: %s", joined)
	}
}
