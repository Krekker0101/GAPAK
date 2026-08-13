package live

import (
	"strings"
	"testing"

	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"
)

func TestHTTPContractRoutes(t *testing.T) {
	app := fiber.New()
	api := app.Group("/api/v1")
	NewController(nil, validator.New()).RegisterRoutes(api, func(c *fiber.Ctx) error { return c.Next() })
	want := map[string]struct{}{
		"GET /api/v1/live-streams":                  {},
		"GET /api/v1/live-streams/:streamId":        {},
		"GET /api/v1/live-streams/:streamId/events": {},
		"GET /api/v1/live-streams/:streamId/chat":   {},
		"POST /api/v1/live-streams":                 {},
		"POST /api/v1/live-streams/:streamId/start": {},
		"POST /api/v1/live-streams/:streamId/end":   {},
		"POST /api/v1/live-streams/:streamId/join":  {},
		"POST /api/v1/live-streams/:streamId/chat":  {},
	}
	seen := map[string]bool{}
	for _, routes := range app.Stack() {
		for _, route := range routes {
			seen[route.Method+" "+strings.TrimRight(route.Path, "/")] = true
		}
	}
	for route := range want {
		if !seen[route] {
			t.Fatalf("missing canonical route %s", route)
		}
	}
}

func TestLiveRequestValidationContract(t *testing.T) {
	validate := validator.New()
	valid := CreateLiveStreamRequest{Title: "Production live", Visibility: "PUBLIC"}
	if err := validate.Struct(valid); err != nil {
		t.Fatalf("valid live DTO rejected: %v", err)
	}
	invalid := valid
	invalid.Visibility = "EVERYONE"
	if err := validate.Struct(invalid); err == nil {
		t.Fatal("invalid visibility must be rejected")
	}
}
