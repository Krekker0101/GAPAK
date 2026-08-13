package config

import "testing"

func secureProductionFixture(t *testing.T) Config {
	t.Helper()
	cfg := validConfig()
	cfg.App.Environment = "production"
	cfg.App.BaseURL = "https://gapak-api-production.up.railway.app"
	cfg.App.CORSOrigins = []string{"https://gapak.vercel.app"}
	cfg.OAuth.FrontendRedirectURL = "https://gapak.vercel.app/"
	cfg.Redis.Enabled = true
	cfg.Redis.URL = "redis://127.0.0.1:6379/0"
	cfg.Security.JWTAccessSecret = "production-access-secret-12345678901234567890"
	cfg.Security.JWTRefreshSecret = "production-refresh-secret-12345678901234567890"
	cfg.Security.PasswordPepper = "production-password-pepper-1234567890"
	cfg.Storage.SigningSecret = "production-storage-signing-secret-1234567890"
	cfg.Anonymity.HashSecret = "production-anonymity-hash-secret-1234567890"
	cfg.Security.EncryptionKey = "cHJvZHVjdGlvbi1hZXMta2V5LTEyMzQ1Njc4OTAxMjM="
	cfg.Security.CookieSecure = true
	cfg.Security.CookieSameSite = "none"
	cfg.Security.CookieDomain = ""
	t.Setenv("CORS_ORIGINS", "https://gapak.vercel.app")
	return cfg
}

func TestValidateProductionAuthCookiePolicy(t *testing.T) {
	cfg := secureProductionFixture(t)
	if err := validate(cfg); err != nil {
		t.Fatalf("expected valid production auth config: %v", err)
	}
}

func TestValidateRejectsProductionCookieDomain(t *testing.T) {
	cfg := secureProductionFixture(t)
	cfg.Security.CookieDomain = "gapak.vercel.app"
	if err := validate(cfg); err == nil {
		t.Fatal("expected COOKIE_DOMAIN rejection")
	}
}

func TestValidateRejectsOAuthRedirectOutsideAllowedOrigins(t *testing.T) {
	cfg := secureProductionFixture(t)
	cfg.OAuth.FrontendRedirectURL = "https://evil.example/"
	if err := validate(cfg); err == nil {
		t.Fatal("expected OAuth redirect origin rejection")
	}
}
