package app

import (
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
)

func TestCredentialedCORSAllowsExactConfiguredOriginOnly(t *testing.T) {
	app := fiber.New()
	app.Use(cors.New(cors.Config{
		AllowCredentials: true,
		AllowOrigins:     "https://gapak.vercel.app",
		AllowHeaders:     "Origin, Content-Type, Authorization, X-CSRF-Token",
		AllowMethods:     "GET,HEAD,POST,OPTIONS",
	}))
	app.Post("/api/v1/test", func(c *fiber.Ctx) error { return c.SendStatus(fiber.StatusNoContent) })

	tests := []struct {
		name, origin      string
		wantAllowedOrigin string
	}{
		{name: "allowed", origin: "https://gapak.vercel.app", wantAllowedOrigin: "https://gapak.vercel.app"},
		{name: "wrong origin", origin: "https://evil.example"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(fiber.MethodPost, "/api/v1/test", nil)
			req.Header.Set("Origin", tc.origin)
			resp, err := app.Test(req)
			if err != nil {
				t.Fatal(err)
			}
			if resp.StatusCode != fiber.StatusNoContent {
				t.Fatalf("expected handler status %d, got %d", fiber.StatusNoContent, resp.StatusCode)
			}
			if got := resp.Header.Get("Access-Control-Allow-Origin"); got != tc.wantAllowedOrigin {
				t.Fatalf("Access-Control-Allow-Origin = %q, want %q", got, tc.wantAllowedOrigin)
			}
			if tc.wantAllowedOrigin != "" && resp.Header.Get("Access-Control-Allow-Credentials") != "true" {
				t.Fatal("missing Allow-Credentials: true")
			}
		})
	}
}

func TestCredentialedCORSPrefightAllowsConfiguredHeaders(t *testing.T) {
	app := fiber.New()
	app.Use(cors.New(cors.Config{
		AllowCredentials: true,
		AllowOrigins:     "https://gapak.vercel.app",
		AllowHeaders:     "Origin, Content-Type, Authorization, X-CSRF-Token, X-Idempotency-Key, X-Request-Id",
		AllowMethods:     "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS",
	}))
	req := httptest.NewRequest(fiber.MethodOptions, "/api/v1/auth/login", nil)
	req.Header.Set("Origin", "https://gapak.vercel.app")
	req.Header.Set("Access-Control-Request-Method", "POST")
	req.Header.Set("Access-Control-Request-Headers", "content-type,authorization,x-csrf-token,x-idempotency-key,x-request-id")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode >= 400 {
		t.Fatalf("preflight rejected: %d", resp.StatusCode)
	}
}
