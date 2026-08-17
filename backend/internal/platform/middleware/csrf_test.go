package middleware

import (
	"context"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"

	"github.com/gapak/backend/internal/config"
	"github.com/gapak/backend/internal/platform/csrf"
	"github.com/gapak/backend/internal/platform/httpx"
	"github.com/gapak/backend/internal/platform/logger"
)

func TestValidateCSRFForMutationsRejectsWrongOriginEvenWithValidServerToken(t *testing.T) {
	store := csrf.NewMemoryStore()
	token, err := store.Issue(context.Background(), "", time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	app := fiber.New(fiber.Config{ErrorHandler: httpx.FiberErrorHandler(logger.New("test"))})
	app.Post("/mutate", ValidateCSRFForMutations(store, nil, structSecurityConfig(), "https://gapak.vercel.app"), func(c *fiber.Ctx) error { return c.SendStatus(fiber.StatusNoContent) })
	req := httptest.NewRequest(fiber.MethodPost, "/mutate", nil)
	req.Header.Set("Origin", "https://evil.example")
	req.Header.Set("X-CSRF-Token", token)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != fiber.StatusForbidden {
		t.Fatalf("expected 403, got %d", resp.StatusCode)
	}
}

func TestValidateCSRFForMutationsAcceptsConfiguredOriginWithoutCSRFCookie(t *testing.T) {
	store := csrf.NewMemoryStore()
	token, err := store.Issue(context.Background(), "", time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	app := fiber.New(fiber.Config{ErrorHandler: httpx.FiberErrorHandler(logger.New("test"))})
	app.Post("/mutate", ValidateCSRFForMutations(store, nil, structSecurityConfig(), "https://gapak.vercel.app"), func(c *fiber.Ctx) error { return c.SendStatus(fiber.StatusNoContent) })
	req := httptest.NewRequest(fiber.MethodPost, "/mutate", nil)
	req.Header.Set("Origin", "https://gapak.vercel.app")
	req.Header.Set("X-CSRF-Token", token)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != fiber.StatusNoContent {
		t.Fatalf("expected 204, got %d", resp.StatusCode)
	}
	if cookie := resp.Header.Get("Set-Cookie"); cookie != "" {
		t.Fatalf("csrf middleware must not set cookies: %s", cookie)
	}
}

func TestValidateCSRFForMutationsRejectsWrongToken(t *testing.T) {
	store := csrf.NewMemoryStore()
	_, err := store.Issue(context.Background(), "", time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	app := fiber.New(fiber.Config{ErrorHandler: httpx.FiberErrorHandler(logger.New("test"))})
	app.Post("/mutate", ValidateCSRFForMutations(store, nil, structSecurityConfig(), "https://gapak.vercel.app"), func(c *fiber.Ctx) error { return c.SendStatus(fiber.StatusNoContent) })
	req := httptest.NewRequest(fiber.MethodPost, "/mutate", nil)
	req.Header.Set("Origin", "https://gapak.vercel.app")
	req.Header.Set("X-CSRF-Token", "wrong")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != fiber.StatusForbidden {
		t.Fatalf("expected 403, got %d", resp.StatusCode)
	}
}

func structSecurityConfig() config.SecurityConfig {
	return config.SecurityConfig{RefreshCookieName: "gapak_rt"}
}
