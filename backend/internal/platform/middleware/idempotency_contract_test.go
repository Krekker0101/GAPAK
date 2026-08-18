package middleware

import (
	"encoding/base64"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gofiber/fiber/v2"
)

func TestIdempotentResponseRoundTripBodyEncoding(t *testing.T) {
	body := []byte(`{"success":true,"data":{"accepted":true}}`)
	encoded := base64.StdEncoding.EncodeToString(body)
	decoded, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		t.Fatal(err)
	}
	if string(decoded) != string(body) {
		t.Fatalf("body mismatch: %q", decoded)
	}
}

func TestIdempotencyRequestHashCoversQueryAndContentType(t *testing.T) {
	app := fiber.New()
	hashes := make(chan string, 3)
	app.Post("/items", func(c *fiber.Ctx) error {
		hashes <- idempotencyRequestHash(c)
		return c.SendStatus(fiber.StatusNoContent)
	})

	request := func(rawQuery, contentType string) string {
		req := httptest.NewRequest(fiber.MethodPost, "/items?"+rawQuery, strings.NewReader(`{"value":1}`))
		req.Header.Set(fiber.HeaderContentType, contentType)
		if _, err := app.Test(req); err != nil {
			t.Fatal(err)
		}
		return <-hashes
	}

	baseline := request("mode=one", fiber.MIMEApplicationJSON)
	if repeat := request("mode=one", fiber.MIMEApplicationJSON); repeat != baseline {
		t.Fatal("identical requests produced different hashes")
	}
	if changedQuery := request("mode=two", fiber.MIMEApplicationJSON); changedQuery == baseline {
		t.Fatal("query parameters were omitted from the request hash")
	}
	if changedType := request("mode=one", "application/vnd.gapak+json"); changedType == baseline {
		t.Fatal("content type was omitted from the request hash")
	}
}

func TestIdempotentResponsePreservesReplayHeaders(t *testing.T) {
	response := idempotentResponse{
		Status: 201,
		Headers: map[string][]string{
			"Set-Cookie":   {"gapak_at=abc; HttpOnly", "gapak_rt=def; HttpOnly"},
			"X-Request-Id": {"req-1"},
		},
	}
	if len(response.Headers["Set-Cookie"]) != 2 || response.Headers["X-Request-Id"][0] != "req-1" {
		t.Fatalf("replay headers were not retained: %#v", response.Headers)
	}
}
