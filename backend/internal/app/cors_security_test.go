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
		name, origin string
		want         int
	}{
		{name: "allowed", origin: "https://gapak.vercel.app", want: fiber.StatusNoContent},
		{name: "wrong origin", origin: "https://evil.example", want: fiber.StatusForbidden},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(fiber.MethodPost, "/api/v1/test", nil)
			req.Header.Set("Origin", tc.origin)
			resp, err := app.Test(req)
			if err != nil {
				t.Fatal(err)
			}
			if resp.StatusCode != tc.want {
				t.Fatalf("expected %d, got %d", tc.want, resp.StatusCode)
			}
			if tc.origin == "https://gapak.vercel.app" && resp.Header.Get("Access-Control-Allow-Credentials") != "true" {
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
