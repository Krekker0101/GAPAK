package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"

	"github.com/gapak/backend/internal/config"
	"github.com/gapak/backend/internal/platform/httpx"
	"github.com/gapak/backend/internal/platform/logger"
)

func TestValidateCSRFForMutationsRejectsWrongOriginEvenWithValidToken(t *testing.T) {
	cfg := config.SecurityConfig{CSRFCookieName: "csrf"}
	app := fiber.New(fiber.Config{ErrorHandler: httpx.FiberErrorHandler(logger.New("test"))})
	app.Post("/mutate", ValidateCSRFForMutations(cfg, "https://gapak.vercel.app"), func(c *fiber.Ctx) error { return c.SendStatus(fiber.StatusNoContent) })
	req := httptest.NewRequest(fiber.MethodPost, "/mutate", nil)
	req.Header.Set("Origin", "https://evil.example")
	req.Header.Set("X-CSRF-Token", "token")
	req.AddCookie(&http.Cookie{Name: "csrf", Value: "token"})
	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != fiber.StatusForbidden {
		t.Fatalf("expected 403, got %d", resp.StatusCode)
	}
}

func TestValidateCSRFForMutationsAcceptsConfiguredOriginWithMatchingCookie(t *testing.T) {
	cfg := config.SecurityConfig{CSRFCookieName: "csrf"}
	app := fiber.New(fiber.Config{ErrorHandler: httpx.FiberErrorHandler(logger.New("test"))})
	app.Post("/mutate", ValidateCSRFForMutations(cfg, "https://gapak.vercel.app"), func(c *fiber.Ctx) error { return c.SendStatus(fiber.StatusNoContent) })
	req := httptest.NewRequest(fiber.MethodPost, "/mutate", nil)
	req.Header.Set("Origin", "https://gapak.vercel.app")
	req.Header.Set("X-CSRF-Token", "token")
	req.AddCookie(&http.Cookie{Name: "csrf", Value: "token"})
	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != fiber.StatusNoContent {
		t.Fatalf("expected 204, got %d", resp.StatusCode)
	}
}
