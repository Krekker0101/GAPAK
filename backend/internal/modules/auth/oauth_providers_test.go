package auth

import (
	"bytes"
	"net/url"
	"testing"

	"github.com/gapak/backend/internal/config"
)

func TestBuildAuthorizeURLIncludesPKCE(t *testing.T) {
	cfg := config.OAuthProviderConfig{
		ClientID:    "client",
		AuthURL:     "https://provider.example/authorize",
		RedirectURI: "https://api.example/callback",
		Scopes:      []string{"openid", "email"},
	}

	raw := buildAuthorizeURL(cfg, "state-value", "challenge-value")
	parsed, err := url.Parse(raw)
	if err != nil {
		t.Fatalf("parse url: %v", err)
	}
	q := parsed.Query()
	if q.Get("state") != "state-value" {
		t.Fatalf("state was not preserved")
	}
	if q.Get("code_challenge") != "challenge-value" {
		t.Fatalf("PKCE challenge was not included")
	}
	if q.Get("code_challenge_method") != "S256" {
		t.Fatalf("expected S256 PKCE")
	}
}

func TestReadOAuthResponseBodyIsBounded(t *testing.T) {
	body := bytes.Repeat([]byte{'x'}, oauthResponseBodyLimit+1)
	if _, err := readOAuthResponseBody(bytes.NewReader(body)); err == nil {
		t.Fatal("oversized OAuth response was accepted")
	}

	want := []byte(`{"ok":true}`)
	got, err := readOAuthResponseBody(bytes.NewReader(want))
	if err != nil || !bytes.Equal(got, want) {
		t.Fatalf("body=%q error=%v", got, err)
	}
}
