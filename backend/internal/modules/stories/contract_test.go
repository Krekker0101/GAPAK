package stories

import (
	"strings"
	"testing"
	"time"

	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"
)

func TestHTTPContractRoutes(t *testing.T) {
	app := fiber.New()
	api := app.Group("/api/v1")
	NewController(nil, validator.New()).RegisterRoutes(api, func(c *fiber.Ctx) error { return c.Next() })
	want := map[string]struct{}{
		"GET /api/v1/stories/feed":                {},
		"GET /api/v1/stories/:storyId":            {},
		"GET /api/v1/stories/:storyId/viewers":    {},
		"POST /api/v1/stories":                    {},
		"POST /api/v1/stories/:storyId/reactions": {},
		"POST /api/v1/stories/:storyId/highlight": {},
		"DELETE /api/v1/stories/:storyId":         {},
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

func TestStoryCreateValidationContract(t *testing.T) {
	validate := validator.New()
	valid := CreateStoryRequest{MediaFileID: "00000000-0000-4000-8000-000000000001", Privacy: "TIMED", ExpiresAt: func() *time.Time { v := time.Now().UTC().Add(time.Hour); return &v }()}
	if err := validate.Struct(valid); err != nil {
		t.Fatalf("valid story DTO rejected: %v", err)
	}
	invalid := valid
	invalid.MediaFileID = "not-a-uuid"
	if err := validate.Struct(invalid); err == nil {
		t.Fatal("invalid mediaFileId must be rejected")
	}
}

func TestStoryCreateContractRejectsExpiredStory(t *testing.T) {
	validate := validator.New()
	// DTO validation covers shape; service normalization enforces temporal semantics.
	valid := CreateStoryRequest{MediaFileID: "00000000-0000-4000-8000-000000000001", Privacy: "TIMED", CustomAudienceUserIDs: []string{"00000000-0000-4000-8000-000000000002"}}
	if err := validate.Struct(valid); err != nil {
		t.Fatalf("baseline story DTO rejected: %v", err)
	}
	expired := time.Now().UTC().Add(-time.Hour)
	valid.ExpiresAt = &expired
	svc := &Service{}
	if _, err := svc.normalizeCreateRequest(valid); err == nil {
		t.Fatal("expired story must be rejected")
	}
}
