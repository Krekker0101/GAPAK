package auth

import (
	"testing"

	"github.com/gapak/backend/internal/config"
	auth "github.com/gapak/backend/internal/platform/auth"
	csrf "github.com/gapak/backend/internal/platform/csrf"
	"github.com/gapak/backend/internal/platform/privacy"
	"github.com/go-playground/validator/v10"
)

func TestOAuthRedirectUsesFrontendOrigin(t *testing.T) {
	ctl := NewController(nil, validator.New(), config.SecurityConfig{}, (*privacy.Service)(nil), csrf.NewMemoryStore(), auth.NewJWTManager(auth.JWTConfig{Issuer: "test", Audience: "test", AccessSecret: "12345678901234567890123456789012", RefreshSecret: "abcdefghijklmnopqrstuvwxyzABCDEF123456"}), "https://gapak.vercel.app/", "https://gapak.vercel.app")
	if got := ctl.configuredFrontendRedirect(); got != "https://gapak.vercel.app/" {
		t.Fatalf("redirect=%q", got)
	}
}
