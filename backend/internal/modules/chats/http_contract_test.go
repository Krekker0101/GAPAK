package chats

import (
	"encoding/json"
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

func TestPreKeyBundleResponseIncludesAllDevicesAndLegacyDevice(t *testing.T) {
	response := PreKeyBundleResponse{
		UserID: "11111111-1111-4111-8111-111111111111",
		Device: TrustedDeviceResponse{ID: "22222222-2222-4222-8222-222222222222"},
		Devices: []PreKeyDeviceBundleResponse{
			{ID: "22222222-2222-4222-8222-222222222222", KeyVersion: 1},
			{ID: "33333333-3333-4333-8333-333333333333", KeyVersion: 1},
		},
	}
	raw, err := json.Marshal(response)
	if err != nil {
		t.Fatal(err)
	}
	var decoded map[string]any
	if err := json.Unmarshal(raw, &decoded); err != nil {
		t.Fatal(err)
	}
	if _, ok := decoded["device"]; !ok {
		t.Fatal("legacy device field is missing")
	}
	devices, ok := decoded["devices"].([]any)
	if !ok || len(devices) != 2 {
		t.Fatalf("devices=%#v", decoded["devices"])
	}
}
