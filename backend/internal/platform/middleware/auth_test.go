package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"

	"github.com/gapak/backend/internal/platform/auth"
	"github.com/gapak/backend/internal/platform/httpx"
	"github.com/gapak/backend/internal/platform/logger"
)

func testJWTManager() *auth.Manager {
	return auth.NewJWTManager(auth.JWTConfig{
		Issuer: "gapak.api", Audience: "gapak.clients",
		AccessSecret:  "12345678901234567890123456789012",
		RefreshSecret: "abcdefghijklmnopqrstuvwxyzABCDEF",
		AccessTTL:     15 * time.Minute, RefreshTTL: 24 * time.Hour,
	})
}

func TestRequireAuthAcceptsHttpOnlyAccessCookie(t *testing.T) {
	manager := testJWTManager()
	pair, err := manager.Issue("user-1", "session-1", "USER", nil)
	if err != nil {
		t.Fatal(err)
	}
	app := fiber.New(fiber.Config{ErrorHandler: httpx.FiberErrorHandler(logger.New("test"))})
	app.Get("/private", RequireAuth(manager), func(c *fiber.Ctx) error { return c.SendString("ok") })
	req := httptest.NewRequest(fiber.MethodGet, "/private", nil)
	req.AddCookie(&http.Cookie{Name: auth.AccessCookieName, Value: pair.AccessToken})
	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
}

func TestRequireAuthRejectsExpiredAccessCookie(t *testing.T) {
	manager := auth.NewJWTManager(auth.JWTConfig{
		Issuer: "gapak.api", Audience: "gapak.clients",
		AccessSecret:  "12345678901234567890123456789012",
		RefreshSecret: "abcdefghijklmnopqrstuvwxyzABCDEF",
		AccessTTL:     -1 * time.Second, RefreshTTL: 24 * time.Hour,
	})
	pair, err := manager.Issue("user-1", "session-1", "USER", nil)
	if err != nil {
		t.Fatal(err)
	}
	app := fiber.New(fiber.Config{ErrorHandler: httpx.FiberErrorHandler(logger.New("test"))})
	app.Get("/private", RequireAuth(manager), func(c *fiber.Ctx) error { return c.SendString("ok") })
	req := httptest.NewRequest(fiber.MethodGet, "/private", nil)
	req.AddCookie(&http.Cookie{Name: auth.AccessCookieName, Value: pair.AccessToken})
	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != fiber.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.StatusCode)
	}
}
