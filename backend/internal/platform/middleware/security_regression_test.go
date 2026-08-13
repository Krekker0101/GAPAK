package middleware

import (
	"testing"

	authplatform "github.com/gapak/backend/internal/platform/auth"
)

func TestRefererMatchesExactAllowedOrigin(t *testing.T) {
	allowed := []string{"https://gapak.vercel.app"}
	cases := []struct {
		name string
		ref  string
		want bool
	}{
		{"exact", "https://gapak.vercel.app/account", true},
		{"subdomain", "https://evil.gapak.vercel.app/account", false},
		{"wrong-scheme", "http://gapak.vercel.app/account", false},
		{"wrong-host", "https://gapak.vercel.app.evil.example/account", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := refererMatchesAllowedOrigin(tc.ref, allowed); got != tc.want {
				t.Fatalf("refererMatchesAllowedOrigin(%q)=%v want %v", tc.ref, got, tc.want)
			}
		})
	}
}

func TestAllowedOriginRejectsNullAndReflectedOrigins(t *testing.T) {
	allowed := []string{"https://gapak.vercel.app"}
	for _, origin := range []string{"null", "https://evil.example", "https://gapak.vercel.app.evil.example"} {
		if isAllowedOrigin(origin, allowed) {
			t.Fatalf("origin %q must be rejected", origin)
		}
	}
}

func TestAccessCookieNameRemainsStableForSecurityIdentity(t *testing.T) {
	if authplatform.AccessCookieName == "" {
		t.Fatal("access cookie name must not be empty")
	}
}
