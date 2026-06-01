package auth

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func TestManagerRejectsUnexpectedSigningMethod(t *testing.T) {
	manager := NewJWTManager(JWTConfig{
		Issuer:        "gapak.api",
		Audience:      "gapak.clients",
		AccessSecret:  "12345678901234567890123456789012",
		RefreshSecret: "abcdefghijklmnopqrstuvwxyzABCDEF",
		AccessTTL:     15 * time.Minute,
		RefreshTTL:    24 * time.Hour,
	})

	raw, err := jwt.NewWithClaims(jwt.SigningMethodHS512, Claims{
		UserID:    "user-1",
		SessionID: "session-1",
		Role:      "USER",
		TokenType: string(TokenTypeAccess),
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    "gapak.api",
			Audience:  []string{"gapak.clients"},
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
		},
	}).SignedString([]byte("12345678901234567890123456789012"))
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}

	if _, err := manager.ParseAccessToken(raw); err == nil {
		t.Fatal("expected HS512 token to be rejected")
	}
}

func TestManagerRejectsRefreshTokenAsAccessToken(t *testing.T) {
	manager := NewJWTManager(JWTConfig{
		Issuer:        "gapak.api",
		Audience:      "gapak.clients",
		AccessSecret:  "12345678901234567890123456789012",
		RefreshSecret: "abcdefghijklmnopqrstuvwxyzABCDEF",
		AccessTTL:     15 * time.Minute,
		RefreshTTL:    24 * time.Hour,
	})

	pair, err := manager.Issue("user-1", "session-1", "USER", nil)
	if err != nil {
		t.Fatalf("issue token pair: %v", err)
	}

	if _, err := manager.ParseAccessToken(pair.RefreshToken); err == nil {
		t.Fatal("expected refresh token to be rejected as access token")
	}
}
