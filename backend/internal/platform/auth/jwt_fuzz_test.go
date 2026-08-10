package auth

import (
	"testing"
	"time"
)

func FuzzParseAccessTokenNeverPanics(f *testing.F) {
	f.Add("")
	f.Add("not-a-jwt")
	f.Add("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIn0.signature")
	f.Fuzz(func(t *testing.T, raw string) {
		manager := NewJWTManager(JWTConfig{
			Issuer: "gapak.api", Audience: "gapak.clients",
			AccessSecret:  "12345678901234567890123456789012",
			RefreshSecret: "abcdefghijklmnopqrstuvwxyzABCDEF",
			AccessTTL:     15 * time.Minute, RefreshTTL: 24 * time.Hour,
		})
		_, _ = manager.ParseAccessToken(raw)
	})
}
