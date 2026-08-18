package httpx

import (
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"

	apperrors "github.com/gapak/backend/internal/platform/errors"
)

type bindBodyFixture struct {
	Name string `json:"name" validate:"required"`
}

func TestBindBodyRequiresJSONContentType(t *testing.T) {
	app := fiber.New()
	var bindErr error
	app.Post("/bind", func(c *fiber.Ctx) error {
		_, bindErr = BindBody[bindBodyFixture](c, validator.New())
		return c.SendStatus(fiber.StatusNoContent)
	})

	req := httptest.NewRequest(fiber.MethodPost, "/bind", strings.NewReader(`{"name":"Gapak"}`))
	req.Header.Set(fiber.HeaderContentType, fiber.MIMEApplicationXML)
	if _, err := app.Test(req); err != nil {
		t.Fatal(err)
	}
	publicErr := apperrors.As(bindErr)
	if publicErr.Status != fiber.StatusUnsupportedMediaType || publicErr.Code != "request.unsupported_media_type" {
		t.Fatalf("unexpected error: %#v", publicErr)
	}
}

func TestBindBodyAcceptsJSONMediaTypes(t *testing.T) {
	for _, contentType := range []string{"application/json", "application/json; charset=utf-8", "application/vnd.gapak+json"} {
		t.Run(contentType, func(t *testing.T) {
			app := fiber.New()
			var payload bindBodyFixture
			var bindErr error
			app.Post("/bind", func(c *fiber.Ctx) error {
				payload, bindErr = BindBody[bindBodyFixture](c, validator.New())
				return c.SendStatus(fiber.StatusNoContent)
			})

			req := httptest.NewRequest(fiber.MethodPost, "/bind", strings.NewReader(`{"name":"Gapak"}`))
			req.Header.Set(fiber.HeaderContentType, contentType)
			if _, err := app.Test(req); err != nil {
				t.Fatal(err)
			}
			if bindErr != nil || payload.Name != "Gapak" {
				t.Fatalf("payload=%#v error=%v", payload, bindErr)
			}
		})
	}
}
