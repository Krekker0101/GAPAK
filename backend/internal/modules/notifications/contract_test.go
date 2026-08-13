package notifications

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
	want := map[string]string{
		"GET /api/v1/notifications/":             "list",
		"GET /api/v1/notifications/unread-count": "unread-count",
		"POST /api/v1/notifications/:id/read":    "read",
		"POST /api/v1/notifications/read-all":    "read-all",
	}
	seen := map[string]bool{}
	for _, routes := range app.Stack() {
		for _, route := range routes {
			key := route.Method + " " + strings.TrimRight(route.Path, "/")
			if _, ok := want[key]; ok {
				seen[key] = true
			}
		}
	}
	for route := range want {
		if !seen[route] {
			t.Fatalf("missing canonical route %s", route)
		}
	}
}

func TestListQueryValidationContract(t *testing.T) {
	validate := validator.New()
	if err := validate.Struct(ListQuery{Limit: 0}); err != nil {
		t.Fatalf("zero limit should use server default: %v", err)
	}
	if err := validate.Struct(ListQuery{Limit: 51}); err == nil {
		t.Fatal("limit > 50 must be rejected")
	}
}
