package config

import (
	"strings"
	"testing"
	"time"
)

func TestValidateRejectsWildcardCORS(t *testing.T) {
	cfg := validConfig()
	cfg.App.CORSOrigins = []string{"*"}

	if err := validate(cfg); err == nil {
		t.Fatal("expected wildcard CORS origin to be rejected")
	}
}

func TestValidateRejectsInvalidEncryptionKeyLength(t *testing.T) {
	cfg := validConfig()
	cfg.Security.EncryptionKey = "Zm9v"

	if err := validate(cfg); err == nil {
		t.Fatal("expected invalid encryption key length to be rejected")
	}
}

func validConfig() Config {
	return Config{
		App: AppConfig{
			Name:        "Gapak API",
			Environment: "test",
			BaseURL:     "http://localhost:8080",
			CORSOrigins: []string{"http://localhost:3000"},
		},
		HTTP: HTTPConfig{
			Host:         "0.0.0.0",
			Port:         "8080",
			ReadTimeout:  1,
			WriteTimeout: 1,
			IdleTimeout:  1,
		},
		Database: DatabaseConfig{
			URL:             "postgresql://postgres:5432@127.0.0.1:5432/gapak?sslmode=disable",
			MaxOpenConns:    20,
			MinOpenConns:    5,
			MaxConnLifetime: 1,
			MaxConnIdleTime: 1,
		},
		Redis: RedisConfig{
			URL: "redis://127.0.0.1:6379/0",
		},
		OAuth: OAuthConfig{
			FrontendRedirectURL: "http://localhost:3000",
		},
		Security: SecurityConfig{
			JWTIssuer:         "gapak.api",
			JWTAudience:       "gapak.clients",
			JWTAccessSecret:   "12345678901234567890123456789012",
			JWTRefreshSecret:  "abcdefghijklmnopqrstuvwxyzABCDEF",
			AccessTokenTTL:    1,
			RefreshTokenTTL:   2,
			PasswordPepper:    "1234567890abcdef",
			EncryptionKey:     "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
			CookieDomain:      "localhost",
			CookieSecure:      false,
			CookieSameSite:    "lax",
			RefreshCookieName: "gapak_rt",
		},
		Anonymity: AnonymityConfig{
			HashSecret: "12345678901234567890123456789012",
		},
		Storage: StorageConfig{
			LocalRootPath:          "./var/storage",
			SigningSecret:          "12345678901234567890123456789012",
			MultipartPartSizeBytes: 8 * 1024 * 1024,
			MaxUploadBytes:         32 * 1024 * 1024,
			AllowedMIMETypes:       []string{"image/jpeg"},
			SignedURLTTL:           1,
			UploadIntentTTL:        1,
			PlaybackGrantTTL:       1,
		},
		Push: PushConfig{
			BatchSize:   20,
			MaxAttempts: 8,
			BaseRetry:   5 * time.Second,
			MaxRetry:    30 * time.Minute,
		},
	}
}

func TestValidateRejectsProductionFallbackSecrets(t *testing.T) {
	cfg := validConfig()
	cfg.App.Environment = "production"
	cfg.App.BaseURL = "https://api.gapak.example"
	cfg.Security.JWTAccessSecret = "default-jwt-access-secret-change-in-production-min-32-chars"
	if err := validate(cfg); err == nil {
		t.Fatal("expected production fallback secret to be rejected")
	}
}

func TestValidateAcceptsSecureProductionConfig(t *testing.T) {
	t.Setenv("CORS_ORIGINS", "https://app.gapak.example")
	cfg := validConfig()
	cfg.App.Environment = "production"
	cfg.App.BaseURL = "https://api.gapak.example"
	cfg.App.CORSOrigins = []string{"https://app.gapak.example"}
	cfg.OAuth.FrontendRedirectURL = "https://app.gapak.example"
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
	if err := validate(cfg); err != nil {
		t.Fatalf("expected secure production config to validate: %v", err)
	}
}

func TestValidateRejectsCrossSiteProductionCookiesWithoutSameSiteNone(t *testing.T) {
	t.Setenv("CORS_ORIGINS", "https://gapak.vercel.app")
	cfg := validConfig()
	cfg.App.Environment = "production"
	cfg.App.BaseURL = "https://gapak-api-production.up.railway.app"
	cfg.App.CORSOrigins = []string{"https://gapak.vercel.app"}
	cfg.Redis.Enabled = true
	cfg.Redis.URL = "redis://127.0.0.1:6379/0"
	cfg.Security.JWTAccessSecret = "production-access-secret-12345678901234567890"
	cfg.Security.JWTRefreshSecret = "production-refresh-secret-12345678901234567890"
	cfg.Security.PasswordPepper = "production-password-pepper-1234567890"
	cfg.Storage.SigningSecret = "production-storage-signing-secret-1234567890"
	cfg.Anonymity.HashSecret = "production-anonymity-hash-secret-1234567890"
	cfg.Security.EncryptionKey = "cHJvZHVjdGlvbi1hZXMta2V5LTEyMzQ1Njc4OTAxMjM="
	cfg.Security.CookieSecure = true
	cfg.Security.CookieSameSite = "lax"
	if err := validate(cfg); err == nil {
		t.Fatal("expected cross-site production cookies without SameSite=None to be rejected")
	}
}

func TestValidateRejectsIncompleteOAuthProvider(t *testing.T) {
	cfg := validConfig()
	cfg.OAuth.Google.ClientID = "client-id"
	if err := validate(cfg); err == nil {
		t.Fatal("expected OAuth provider without client secret to be rejected")
	}
}

func TestValidateRejectsInsecureProductionOAuthEndpoint(t *testing.T) {
	t.Setenv("CORS_ORIGINS", "https://app.gapak.example")
	cfg := validConfig()
	cfg.App.Environment = "production"
	cfg.App.BaseURL = "https://api.gapak.example"
	cfg.App.CORSOrigins = []string{"https://app.gapak.example"}
	cfg.OAuth.FrontendRedirectURL = "https://app.gapak.example"
	cfg.Redis.Enabled = true
	cfg.Security.CookieDomain = ""
	cfg.Security.CookieSecure = true
	cfg.Security.CookieSameSite = "none"
	cfg.Security.JWTAccessSecret = "production-access-secret-12345678901234567890"
	cfg.Security.JWTRefreshSecret = "production-refresh-secret-12345678901234567890"
	cfg.Security.PasswordPepper = "production-password-pepper-1234567890"
	cfg.Storage.SigningSecret = "production-storage-signing-secret-1234567890"
	cfg.Anonymity.HashSecret = "production-anonymity-hash-secret-1234567890"
	cfg.OAuth.Google = OAuthProviderConfig{
		ClientID:     "client-id",
		ClientSecret: "client-secret",
		AuthURL:      "https://accounts.example/authorize",
		TokenURL:     "http://accounts.example/token",
		UserInfoURL:  "https://accounts.example/userinfo",
		RedirectURI:  "https://api.gapak.example/api/v1/auth/callback/google",
	}
	if err := validate(cfg); err == nil || !strings.Contains(err.Error(), "TOKEN_URL") {
		t.Fatalf("expected insecure OAuth token endpoint to be rejected, got %v", err)
	}
}
