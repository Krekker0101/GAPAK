package config

import "testing"

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
		},
		Redis: RedisConfig{
			URL: "redis://127.0.0.1:6379/0",
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
			CSRFCookieName:    "gapak_csrf",
		},
		Anonymity: AnonymityConfig{
			HashSecret: "12345678901234567890123456789012",
		},
		Storage: StorageConfig{
			SigningSecret:          "12345678901234567890123456789012",
			MultipartPartSizeBytes: 8 * 1024 * 1024,
			MaxUploadBytes:         32 * 1024 * 1024,
			AllowedMIMETypes:       []string{"image/jpeg"},
			SignedURLTTL:           1,
			UploadIntentTTL:        1,
			PlaybackGrantTTL:       1,
		},
	}
}
