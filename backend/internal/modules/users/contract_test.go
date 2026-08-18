package users

import (
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"

	"github.com/gapak/backend/internal/platform/httpx"
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

func TestStaticDiscoveryRoutesPrecedeUserIDRoute(t *testing.T) {
	app := fiber.New()
	api := app.Group("/api/v1")
	NewController(nil, validator.New()).RegisterRoutes(api, func(c *fiber.Ctx) error { return c.Next() })
	positions := map[string]int{}
	position := 0
	for _, routes := range app.Stack() {
		for _, route := range routes {
			if route.Method != fiber.MethodGet {
				continue
			}
			positions[route.Path] = position
			position++
		}
	}
	dynamicPosition, found := positions["/api/v1/users/:userId"]
	if !found {
		t.Fatal("missing /:userId route")
	}
	for _, staticPath := range []string{"/api/v1/users/search", "/api/v1/users/discover"} {
		staticPosition, found := positions[staticPath]
		if !found {
			t.Fatalf("missing static route %s", staticPath)
		}
		if staticPosition >= dynamicPosition {
			t.Fatalf("static route %s must be registered before /:userId", staticPath)
		}
	}
}

func TestDiscoverProductionQueryParses(t *testing.T) {
	validate := validator.New()
	app := fiber.New()
	app.Get("/discover", func(c *fiber.Ctx) error {
		query, err := httpx.BindQuery[DiscoverUsersQuery](c, validate)
		if err != nil {
			return err
		}
		if query.Sort != "top" || query.Limit != 6 {
			t.Fatalf("unexpected parsed query: %+v", query)
		}
		return c.SendStatus(fiber.StatusNoContent)
	})
	response, err := app.Test(httptest.NewRequest(fiber.MethodGet, "/discover?sort=top&limit=6", nil))
	if err != nil {
		t.Fatal(err)
	}
	if response.StatusCode != fiber.StatusNoContent {
		t.Fatalf("production discovery query returned %d", response.StatusCode)
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
