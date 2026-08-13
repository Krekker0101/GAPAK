package media

import (
	"strings"
	"testing"
	"time"

	"github.com/gapak/backend/internal/platform/storage"

	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"
)

func TestHTTPContractRoutes(t *testing.T) {
	app := fiber.New()
	api := app.Group("/api/v1")
	NewController(nil, validator.New()).RegisterRoutes(api, func(c *fiber.Ctx) error { return c.Next() })
	want := map[string]struct{}{
		"POST /api/v1/media/upload-sessions":                     {},
		"GET /api/v1/media/upload-sessions/:sessionId":           {},
		"POST /api/v1/media/upload-sessions/:sessionId/parts":    {},
		"POST /api/v1/media/upload-sessions/:sessionId/complete": {},
		"POST /api/v1/media/upload-sessions/:sessionId/abort":    {},
		"GET /api/v1/media/assets/:mediaId":                      {},
		"POST /api/v1/media/assets/:mediaId/playback-grants":     {},
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

func TestUploadRequestValidationContract(t *testing.T) {
	validate := validator.New()
	valid := CreateUploadSessionRequest{Purpose: "STORY", FileName: "clip.mp4", MimeType: "video/mp4", SizeBytes: 1024}
	if err := validate.Struct(valid); err != nil {
		t.Fatalf("valid upload session DTO rejected: %v", err)
	}
	invalid := valid
	invalid.Purpose = "UNKNOWN"
	if err := validate.Struct(invalid); err == nil {
		t.Fatal("unknown upload purpose must be rejected")
	}
}

func TestSignedRequestContractRejectsUnavailableProviderResult(t *testing.T) {
	svc := &Service{}
	_, err := svc.signedRequest(storage.SignedRequest{
		Method:    "GET",
		URL:       "",
		ExpiresAt: time.Now().UTC().Add(time.Minute),
	})
	if err == nil {
		t.Fatal("empty signed URL must never be returned as success")
	}
}

func TestSignedRequestContractRejectsExpiredResult(t *testing.T) {
	svc := &Service{}
	_, err := svc.signedRequest(storage.SignedRequest{
		Method:    "GET",
		URL:       "https://example.invalid/signed",
		ExpiresAt: time.Now().UTC().Add(-time.Minute),
	})
	if err == nil {
		t.Fatal("expired signed URL must never be returned as success")
	}
}
