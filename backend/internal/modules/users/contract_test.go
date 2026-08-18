package users

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
		"GET /api/v1/users/me":           {},
		"GET /api/v1/users/search":       {},
		"GET /api/v1/users/discover":     {},
		"GET /api/v1/users/:userId":      {},
		"PATCH /api/v1/users/me":         {},
		"PATCH /api/v1/users/me/privacy": {},
		"PATCH /api/v1/users/me/theme":   {},
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

func TestDiscoveryQueryValidation(t *testing.T) {
	validate := validator.New()
	if err := validate.Struct(DiscoverUsersQuery{Sort: "top", Limit: 6}); err != nil {
		t.Fatalf("valid discovery query rejected: %v", err)
	}
	if err := validate.Struct(DiscoverUsersQuery{Sort: "unknown", Limit: 6}); err == nil {
		t.Fatal("unknown discovery sort must be rejected")
	}
	if err := validate.Struct(SearchUsersQuery{Query: "a", Limit: 20}); err == nil {
		t.Fatal("one-character search query must be rejected")
	}
}
