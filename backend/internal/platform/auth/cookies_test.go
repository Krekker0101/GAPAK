package auth

import (
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gapak/backend/internal/config"
	"github.com/gofiber/fiber/v2"
)

func TestParseSameSite(t *testing.T) {
	cases := map[string]string{"strict": fiber.CookieSameSiteStrictMode, "lax": fiber.CookieSameSiteLaxMode, "none": fiber.CookieSameSiteNoneMode, "": fiber.CookieSameSiteLaxMode}
	for input, want := range cases {
		if got := parseSameSite(input); got != want {
			t.Fatalf("parseSameSite(%q)=%q want %q", input, got, want)
		}
	}
}

func TestCookiesHonorConfiguredSameSite(t *testing.T) {
	app := fiber.New()
	cfg := config.SecurityConfig{RefreshCookieName: "gapak_rt", CSRFCookieName: "gapak_csrf", CookieSecure: true, CookieSameSite: "none"}
	app.Get("/", func(c *fiber.Ctx) error {
		SetRefreshCookie(c, cfg, "token", time.Now().Add(time.Hour))
		SetCSRFCookie(c, cfg, "csrf", time.Now().Add(time.Hour))
		return nil
	})
	req := httptest.NewRequest(fiber.MethodGet, "/", nil)
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	cookies := resp.Header.Values("Set-Cookie")
	if len(cookies) != 2 {
		t.Fatalf("expected 2 cookies, got %d", len(cookies))
	}
	for _, cookie := range cookies {
		if !containsFold(cookie, "SameSite=None") {
			t.Fatalf("cookie missing SameSite=None: %s", cookie)
		}
		if !containsFold(cookie, "Secure") {
			t.Fatalf("cookie missing Secure: %s", cookie)
		}
	}
}

func containsFold(s, sub string) bool {
	return len(s) >= len(sub) && (s == sub || indexFold(s, sub) >= 0)
}
func indexFold(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if equalFold(s[i:i+len(sub)], sub) {
			return i
		}
	}
	return -1
}
func equalFold(a, b string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		ca, cb := a[i], b[i]
		if ca >= 'A' && ca <= 'Z' {
			ca += 32
		}
		if cb >= 'A' && cb <= 'Z' {
			cb += 32
		}
		if ca != cb {
			return false
		}
	}
	return true
}
