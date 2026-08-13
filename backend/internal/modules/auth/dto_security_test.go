package auth

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestAuthResponseNeverSerializesRefreshToken(t *testing.T) {
	value := AuthResponse{AccessToken: "access", RefreshTTL: 3600}
	b, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(b), "refreshToken\"") {
		t.Fatalf("refreshToken was serialized: %s", b)
	}
	if !strings.Contains(string(b), "accessToken") {
		t.Fatalf("accessToken missing: %s", b)
	}
}
