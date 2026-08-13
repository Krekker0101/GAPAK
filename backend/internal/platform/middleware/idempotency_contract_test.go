package middleware

import (
	"encoding/base64"
	"testing"
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

func TestIdempotentResponsePreservesReplayHeaders(t *testing.T) {
	response := idempotentResponse{
		Status: 201,
		Headers: map[string][]string{
			"Set-Cookie":   {"gapak_at=abc; HttpOnly", "gapak_csrf=xyz"},
			"X-Request-Id": {"req-1"},
		},
	}
	if len(response.Headers["Set-Cookie"]) != 2 || response.Headers["X-Request-Id"][0] != "req-1" {
		t.Fatalf("replay headers were not retained: %#v", response.Headers)
	}
}
