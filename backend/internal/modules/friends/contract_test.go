package friends

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
		"GET /api/v1/connections":                              {},
		"GET /api/v1/connections/suggestions":                  {},
		"POST /api/v1/connections/requests":                    {},
		"POST /api/v1/connections/:connectionId/accept":        {},
		"PUT /api/v1/connections/:connectionId/trusted-circle": {},
		"DELETE /api/v1/connections/:connectionId":             {},
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

func TestCreateConnectionValidationContract(t *testing.T) {
	validate := validator.New()
	if err := validate.Struct(CreateConnectionRequest{TargetUserID: "00000000-0000-4000-8000-000000000001"}); err != nil {
		t.Fatalf("valid connection request rejected: %v", err)
	}
	if err := validate.Struct(CreateConnectionRequest{TargetUserID: "not-a-uuid"}); err == nil {
		t.Fatal("invalid targetUserId must be rejected")
	}
}

func TestConnectionCreateContractRejectsSelfRequest(t *testing.T) {
	svc := NewService(nil)
	_, err := svc.Create(nil, "00000000-0000-4000-8000-000000000001", CreateConnectionRequest{TargetUserID: "00000000-0000-4000-8000-000000000001"})
	if err == nil {
		t.Fatal("self connection request must be rejected before repository access")
	}
}
