package app

import (
	"testing"

	"github.com/gapak/backend/internal/platform/auth"
)

func TestWebSocketOriginExactMatch(t *testing.T) {
	allowed := []string{"https://gapak.vercel.app"}
	if !isAllowedOrigin("https://gapak.vercel.app", allowed) {
		t.Fatal("expected allowed origin")
	}
	if isAllowedOrigin("https://evil.example", allowed) {
		t.Fatal("unexpectedly allowed origin")
	}
}

func TestWebSocketUsesAccessCookieName(t *testing.T) {
	if auth.AccessCookieName != "gapak_at" {
		t.Fatalf("unexpected access cookie name: %s", auth.AccessCookieName)
	}
}
