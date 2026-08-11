package httpx

import (
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"

	"github.com/gapak/backend/internal/platform/logger"
)

func TestFiberErrorHandlerPreservesNotFound(t *testing.T) {
	app := fiber.New(fiber.Config{ErrorHandler: FiberErrorHandler(logger.New("test"))})
	app.Get("/known", func(c *fiber.Ctx) error { return c.SendStatus(fiber.StatusNoContent) })

	req := httptest.NewRequest("GET", "/missing", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != fiber.StatusNotFound {
		t.Fatalf("expected 404, got %d", resp.StatusCode)
	}
}

func TestFiberErrorHandlerPreservesMethodNotAllowed(t *testing.T) {
	app := fiber.New(fiber.Config{ErrorHandler: FiberErrorHandler(logger.New("test"))})
	app.Get("/known", func(c *fiber.Ctx) error { return c.SendStatus(fiber.StatusNoContent) })

	req := httptest.NewRequest("POST", "/known", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != fiber.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d", resp.StatusCode)
	}
}
