package chats

import (
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
)

func TestPreKeyBundleRouteUsesPathUserID(t *testing.T) {
	const userID = "11111111-1111-4111-8111-111111111111"
	app := fiber.New()
	app.Get("/api/v1/chats/pre-key-bundles/:userId", func(c *fiber.Ctx) error {
		parsed, err := preKeyBundleUserID(c)
		if err != nil {
			return err
		}
		return c.SendString(parsed)
	})

	resp, err := app.Test(httptest.NewRequest(fiber.MethodGet, "/api/v1/chats/pre-key-bundles/"+userID, nil), -1)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("status=%d", resp.StatusCode)
	}
}
