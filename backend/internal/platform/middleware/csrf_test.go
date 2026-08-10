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

func TestValidateCSRFForMutationsRequiresCookieAndMatchingHeader(t *testing.T) {
	cfg := config.SecurityConfig{CSRFCookieName: "csrf"}
	app := fiber.New(fiber.Config{ErrorHandler: httpx.FiberErrorHandler(logger.New("test"))})
	app.Post("/mutate", ValidateCSRFForMutations(cfg), func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusNoContent)
	})

	cases := []struct {
		name       string
		cookie     string
		header     string
		wantStatus int
	}{
		{"missing both", "", "", fiber.StatusForbidden},
		{"header only", "", "token", fiber.StatusForbidden},
		{"cookie only", "token", "", fiber.StatusForbidden},
		{"mismatch", "cookie", "header", fiber.StatusForbidden},
		{"match", "token", "token", fiber.StatusNoContent},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(fiber.MethodPost, "/mutate", nil)
			if tc.cookie != "" {
				req.AddCookie(&http.Cookie{Name: "csrf", Value: tc.cookie})
			}
			if tc.header != "" {
				req.Header.Set("X-CSRF-Token", tc.header)
			}
			resp, err := app.Test(req)
			if err != nil {
				t.Fatalf("request failed: %v", err)
			}
			if resp.StatusCode != tc.wantStatus {
				t.Fatalf("expected %d, got %d", tc.wantStatus, resp.StatusCode)
			}
		})
	}
}
