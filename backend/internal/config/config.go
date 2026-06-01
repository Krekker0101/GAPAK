package config

import (
	"encoding/base64"
	"fmt"
	"net/url"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	App       AppConfig
	HTTP      HTTPConfig
	Database  DatabaseConfig
	Redis     RedisConfig
	Security  SecurityConfig
	Anonymity AnonymityConfig
	Storage   StorageConfig
	Queue     QueueConfig
	Worker    WorkerConfig
	RateLimit RateLimitConfig
}

type AppConfig struct {
	Name        string
	Environment string
	BaseURL     string
	CORSOrigins []string
}

type HTTPConfig struct {
	Host         string
	Port         string
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
	IdleTimeout  time.Duration
}

type DatabaseConfig struct {
	URL             string
	MaxOpenConns    int32
	MinOpenConns    int32
	MaxConnLifetime time.Duration
}

type RedisConfig struct {
	URL string
}

type SecurityConfig struct {
	JWTIssuer         string
	JWTAudience       string
	JWTAccessSecret   string
	JWTRefreshSecret  string
	AccessTokenTTL    time.Duration
	RefreshTokenTTL   time.Duration
	PasswordPepper    string
	EncryptionKey     string
	CookieDomain      string
	CookieSecure      bool
	CookieSameSite    string
	RefreshCookieName string
	CSRFCookieName    string
	TOTPWindow        int
}

type AnonymityConfig struct {
	Enabled                   bool
	RequirePseudonymousSignup bool
	AllowAnonymousSignup      bool
	AllowEmailSignup          bool
	AllowPasswordRecovery     bool
	TrustProxyHeaders         bool
	ProxyHeaders              []string
	HashSecret                string
	StoreIP                   bool
	StoreUserAgent            bool
	StoreDeviceFingerprint    bool
	LogNetworkMetadata        bool
	ExposeEmailInResponses    bool
}

type StorageConfig struct {
	Provider               string
	LocalRootPath          string
	Endpoint               string
	Region                 string
	AccessKeyID            string
	SecretAccessKey        string
	Bucket                 string
	PublicBaseURL          string
	ProtectedBaseURL       string
	PublicCDNBaseURL       string
	ProtectedCDNBaseURL    string
	SignedURLTTL           time.Duration
	UploadIntentTTL        time.Duration
	PlaybackGrantTTL       time.Duration
	SigningSecret          string
	MultipartPartSizeBytes int64
	MaxUploadBytes         int64
	AllowedMIMETypes       []string
}

type QueueConfig struct {
	MediaProcessingQueue string
	StoryProcessingQueue string
	LiveReplayQueue      string
	CleanupQueue         string
	LiveEventChannel     string
	ClaimTTL             time.Duration
}

type WorkerConfig struct {
	PollInterval            time.Duration
	BatchSize               int64
	MediaProcessingParallel int
	StoryDefaultTTL         time.Duration
	LiveReplayRetention     time.Duration
}

type RateLimitConfig struct {
	GlobalWindow   time.Duration
	GlobalMax      int64
	AuthWindow     time.Duration
	AuthMax        int64
	PasswordWindow time.Duration
	PasswordMax    int64
}

func Load() (Config, error) {
	if err := godotenv.Load(); err != nil && !os.IsNotExist(err) {
		return Config{}, fmt.Errorf("failed to load .env file: %w", err)
	}

	cfg := Config{
		App: AppConfig{
			Name:        getEnv("APP_NAME", "Gapak API"),
			Environment: getEnv("APP_ENV", "development"),
			BaseURL:     getEnv("APP_BASE_URL", "http://localhost:8080"),
			CORSOrigins: getEnvSlice("CORS_ORIGINS", []string{"http://localhost:3000"}),
		},
		HTTP: HTTPConfig{
			Host:         getEnv("APP_HOST", "0.0.0.0"),
			Port:         getEnv("APP_PORT", "8080"),
			ReadTimeout:  getEnvDuration("HTTP_READ_TIMEOUT", 15*time.Second),
			WriteTimeout: getEnvDuration("HTTP_WRITE_TIMEOUT", 15*time.Second),
			IdleTimeout:  getEnvDuration("HTTP_IDLE_TIMEOUT", 60*time.Second),
		},
		Database: DatabaseConfig{
			URL:             requireEnv("DATABASE_URL"),
			MaxOpenConns:    int32(getEnvInt("DATABASE_MAX_OPEN_CONNS", 20)),
			MinOpenConns:    int32(getEnvInt("DATABASE_MIN_OPEN_CONNS", 5)),
			MaxConnLifetime: getEnvDuration("DATABASE_MAX_CONN_LIFETIME", 30*time.Minute),
		},
		Redis: RedisConfig{
			URL: requireEnv("REDIS_URL"),
		},
		Security: SecurityConfig{
			JWTIssuer:         getEnv("JWT_ISSUER", "gapak.api"),
			JWTAudience:       getEnv("JWT_AUDIENCE", "gapak.clients"),
			JWTAccessSecret:   requireEnv("JWT_ACCESS_SECRET"),
			JWTRefreshSecret:  requireEnv("JWT_REFRESH_SECRET"),
			AccessTokenTTL:    getEnvDuration("JWT_ACCESS_TTL", 15*time.Minute),
			RefreshTokenTTL:   getEnvDuration("JWT_REFRESH_TTL", 30*24*time.Hour),
			PasswordPepper:    getEnv("PASSWORD_PEPPER", ""),
			EncryptionKey:     requireEnv("ENCRYPTION_KEY_BASE64"),
			CookieDomain:      getEnv("COOKIE_DOMAIN", "localhost"),
			CookieSecure:      getEnvBool("COOKIE_SECURE", false),
			CookieSameSite:    getEnv("COOKIE_SAME_SITE", "lax"),
			RefreshCookieName: getEnv("REFRESH_COOKIE_NAME", "gapak_rt"),
			CSRFCookieName:    getEnv("CSRF_COOKIE_NAME", "gapak_csrf"),
			TOTPWindow:        getEnvInt("TOTP_WINDOW", 1),
		},
		Anonymity: AnonymityConfig{
			Enabled:                   getEnvBool("ANONYMITY_ENABLED", true),
			RequirePseudonymousSignup: getEnvBool("ANONYMITY_REQUIRE_PSEUDONYMOUS_SIGNUP", true),
			AllowAnonymousSignup:      getEnvBool("ANONYMITY_ALLOW_ANONYMOUS_SIGNUP", true),
			AllowEmailSignup:          getEnvBool("ANONYMITY_ALLOW_EMAIL_SIGNUP", false),
			AllowPasswordRecovery:     getEnvBool("ANONYMITY_ALLOW_PASSWORD_RECOVERY", false),
			TrustProxyHeaders:         getEnvBool("ANONYMITY_TRUST_PROXY_HEADERS", true),
			ProxyHeaders:              getEnvSlice("ANONYMITY_PROXY_HEADERS", []string{"CF-Connecting-IP", "X-Forwarded-For", "X-Real-IP"}),
			HashSecret:                requireEnv("ANONYMITY_HASH_SECRET"),
			StoreIP:                   getEnvBool("ANONYMITY_STORE_IP", false),
			StoreUserAgent:            getEnvBool("ANONYMITY_STORE_USER_AGENT", false),
			StoreDeviceFingerprint:    getEnvBool("ANONYMITY_STORE_DEVICE_FINGERPRINT", false),
			LogNetworkMetadata:        getEnvBool("ANONYMITY_LOG_NETWORK_METADATA", false),
			ExposeEmailInResponses:    getEnvBool("ANONYMITY_EXPOSE_EMAIL_IN_RESPONSES", false),
		},
		Storage: StorageConfig{
			Provider:               getEnv("STORAGE_PROVIDER", "s3"),
			LocalRootPath:          getEnv("STORAGE_LOCAL_ROOT_PATH", "./var/storage"),
			Endpoint:               getEnv("STORAGE_ENDPOINT", "http://minio:9000"),
			Region:                 getEnv("STORAGE_REGION", "us-east-1"),
			AccessKeyID:            getEnv("STORAGE_ACCESS_KEY_ID", ""),
			SecretAccessKey:        getEnv("STORAGE_SECRET_ACCESS_KEY", ""),
			Bucket:                 getEnv("STORAGE_BUCKET", "gapak-private"),
			PublicBaseURL:          getEnv("STORAGE_PUBLIC_BASE_URL", ""),
			ProtectedBaseURL:       getEnv("STORAGE_PROTECTED_BASE_URL", ""),
			PublicCDNBaseURL:       getEnv("STORAGE_PUBLIC_CDN_BASE_URL", ""),
			ProtectedCDNBaseURL:    getEnv("STORAGE_PROTECTED_CDN_BASE_URL", ""),
			SignedURLTTL:           getEnvDuration("STORAGE_SIGNED_URL_TTL", 15*time.Minute),
			UploadIntentTTL:        getEnvDuration("STORAGE_UPLOAD_INTENT_TTL", 30*time.Minute),
			PlaybackGrantTTL:       getEnvDuration("STORAGE_PLAYBACK_GRANT_TTL", 5*time.Minute),
			SigningSecret:          requireEnv("STORAGE_SIGNING_SECRET"),
			MultipartPartSizeBytes: getEnvInt64("STORAGE_MULTIPART_PART_SIZE_BYTES", 8*1024*1024),
			MaxUploadBytes:         getEnvInt64("STORAGE_MAX_UPLOAD_BYTES", 25*1024*1024),
			AllowedMIMETypes:       getEnvSlice("STORAGE_ALLOWED_MIME_TYPES", []string{"image/jpeg", "image/png", "image/webp", "video/mp4", "application/pdf"}),
		},
		Queue: QueueConfig{
			MediaProcessingQueue: getEnv("QUEUE_MEDIA_PROCESSING", "queue:media:processing"),
			StoryProcessingQueue: getEnv("QUEUE_STORY_PROCESSING", "queue:story:processing"),
			LiveReplayQueue:      getEnv("QUEUE_LIVE_REPLAY", "queue:live:replay"),
			CleanupQueue:         getEnv("QUEUE_CLEANUP", "queue:cleanup"),
			LiveEventChannel:     getEnv("QUEUE_LIVE_EVENTS", "realtime:live-events"),
			ClaimTTL:             getEnvDuration("QUEUE_CLAIM_TTL", 5*time.Minute),
		},
		Worker: WorkerConfig{
			PollInterval:            getEnvDuration("WORKER_POLL_INTERVAL", 2*time.Second),
			BatchSize:               int64(getEnvInt("WORKER_BATCH_SIZE", 10)),
			MediaProcessingParallel: getEnvInt("WORKER_MEDIA_CONCURRENCY", 4),
			StoryDefaultTTL:         getEnvDuration("STORY_DEFAULT_TTL", 24*time.Hour),
			LiveReplayRetention:     getEnvDuration("LIVE_REPLAY_RETENTION", 30*24*time.Hour),
		},
		RateLimit: RateLimitConfig{
			GlobalWindow:   getEnvDuration("RATE_LIMIT_GLOBAL_WINDOW", time.Minute),
			GlobalMax:      int64(getEnvInt("RATE_LIMIT_GLOBAL_MAX", 120)),
			AuthWindow:     getEnvDuration("RATE_LIMIT_AUTH_WINDOW", 5*time.Minute),
			AuthMax:        int64(getEnvInt("RATE_LIMIT_AUTH_MAX", 10)),
			PasswordWindow: getEnvDuration("RATE_LIMIT_PASSWORD_WINDOW", 15*time.Minute),
			PasswordMax:    int64(getEnvInt("RATE_LIMIT_PASSWORD_MAX", 5)),
		},
	}

	if cfg.Security.JWTAccessSecret == cfg.Security.JWTRefreshSecret {
		return Config{}, fmt.Errorf("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different")
	}

	if strings.TrimSpace(cfg.Storage.PublicBaseURL) == "" {
		cfg.Storage.PublicBaseURL = strings.TrimRight(cfg.App.BaseURL, "/") + "/api/v1/media/gateway"
	}
	if strings.TrimSpace(cfg.Storage.ProtectedBaseURL) == "" {
		cfg.Storage.ProtectedBaseURL = strings.TrimRight(cfg.App.BaseURL, "/") + "/api/v1/media/protected"
	}

	if err := validate(cfg); err != nil {
		return Config{}, err
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	value, ok := os.LookupEnv(key)
	if !ok || strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}

func requireEnv(key string) string {
	return getEnv(key, "")
}

func getEnvInt(key string, fallback int) int {
	raw := getEnv(key, "")
	if raw == "" {
		return fallback
	}
	value, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	return value
}

func getEnvInt64(key string, fallback int64) int64 {
	raw := getEnv(key, "")
	if raw == "" {
		return fallback
	}
	value, err := strconv.ParseInt(raw, 10, 64)
	if err != nil {
		return fallback
	}
	return value
}

func getEnvBool(key string, fallback bool) bool {
	raw := getEnv(key, "")
	if raw == "" {
		return fallback
	}
	value, err := strconv.ParseBool(raw)
	if err != nil {
		return fallback
	}
	return value
}

func getEnvDuration(key string, fallback time.Duration) time.Duration {
	raw := getEnv(key, "")
	if raw == "" {
		return fallback
	}
	value, err := time.ParseDuration(raw)
	if err != nil {
		return fallback
	}
	return value
}

func getEnvSlice(key string, fallback []string) []string {
	raw := getEnv(key, "")
	if raw == "" {
		return fallback
	}
	parts := strings.Split(raw, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" {
			result = append(result, part)
		}
	}
	if len(result) == 0 {
		return fallback
	}
	return result
}

func validate(cfg Config) error {
	required := map[string]string{
		"DATABASE_URL":           cfg.Database.URL,
		"REDIS_URL":              cfg.Redis.URL,
		"JWT_ACCESS_SECRET":      cfg.Security.JWTAccessSecret,
		"JWT_REFRESH_SECRET":     cfg.Security.JWTRefreshSecret,
		"PASSWORD_PEPPER":        cfg.Security.PasswordPepper,
		"ENCRYPTION_KEY_BASE64":  cfg.Security.EncryptionKey,
		"STORAGE_SIGNING_SECRET": cfg.Storage.SigningSecret,
		"ANONYMITY_HASH_SECRET":  cfg.Anonymity.HashSecret,
	}
	missing := make([]string, 0)
	for key, value := range required {
		if strings.TrimSpace(value) == "" {
			missing = append(missing, key)
		}
	}
	if len(missing) > 0 {
		sort.Strings(missing)
		return fmt.Errorf("missing required envs: %s", strings.Join(missing, ", "))
	}

	if cfg.Database.MaxOpenConns <= 0 {
		return fmt.Errorf("DATABASE_MAX_OPEN_CONNS must be greater than zero")
	}
	if cfg.Database.MinOpenConns < 0 {
		return fmt.Errorf("DATABASE_MIN_OPEN_CONNS cannot be negative")
	}
	if cfg.Database.MinOpenConns > cfg.Database.MaxOpenConns {
		return fmt.Errorf("DATABASE_MIN_OPEN_CONNS cannot exceed DATABASE_MAX_OPEN_CONNS")
	}
	if cfg.HTTP.ReadTimeout <= 0 || cfg.HTTP.WriteTimeout <= 0 || cfg.HTTP.IdleTimeout <= 0 {
		return fmt.Errorf("HTTP timeouts must be positive")
	}
	if cfg.Security.AccessTokenTTL <= 0 || cfg.Security.RefreshTokenTTL <= 0 {
		return fmt.Errorf("JWT TTL values must be positive")
	}
	if cfg.Security.RefreshTokenTTL <= cfg.Security.AccessTokenTTL {
		return fmt.Errorf("JWT_REFRESH_TTL must be greater than JWT_ACCESS_TTL")
	}
	if len(cfg.Security.JWTAccessSecret) < 32 || len(cfg.Security.JWTRefreshSecret) < 32 {
		return fmt.Errorf("JWT secrets must be at least 32 characters long")
	}
	if len(cfg.Security.PasswordPepper) < 16 {
		return fmt.Errorf("PASSWORD_PEPPER must be at least 16 characters long")
	}
	if len(cfg.Storage.SigningSecret) < 32 {
		return fmt.Errorf("STORAGE_SIGNING_SECRET must be at least 32 characters long")
	}
	if len(cfg.Anonymity.HashSecret) < 32 {
		return fmt.Errorf("ANONYMITY_HASH_SECRET must be at least 32 characters long")
	}
	switch strings.ToLower(cfg.Security.CookieSameSite) {
	case "lax", "strict", "none":
	default:
		return fmt.Errorf("COOKIE_SAME_SITE must be one of lax, strict, none")
	}
	if strings.EqualFold(cfg.Security.CookieSameSite, "none") && !cfg.Security.CookieSecure {
		return fmt.Errorf("COOKIE_SECURE must be true when COOKIE_SAME_SITE=none")
	}
	if len(cfg.App.CORSOrigins) == 0 {
		return fmt.Errorf("CORS_ORIGINS must contain at least one explicit origin")
	}
	for _, origin := range cfg.App.CORSOrigins {
		if origin == "*" {
			return fmt.Errorf("wildcard CORS origins are not allowed with credentialed auth")
		}
		parsed, err := url.Parse(origin)
		if err != nil || parsed.Scheme == "" || parsed.Host == "" {
			return fmt.Errorf("invalid CORS origin: %s", origin)
		}
	}
	if cfg.Storage.MaxUploadBytes <= 0 {
		return fmt.Errorf("STORAGE_MAX_UPLOAD_BYTES must be greater than zero")
	}
	if strings.TrimSpace(cfg.Storage.LocalRootPath) == "" {
		return fmt.Errorf("STORAGE_LOCAL_ROOT_PATH cannot be empty")
	}
	if cfg.Storage.MultipartPartSizeBytes <= 0 {
		return fmt.Errorf("STORAGE_MULTIPART_PART_SIZE_BYTES must be greater than zero")
	}
	if cfg.Storage.MultipartPartSizeBytes > cfg.Storage.MaxUploadBytes {
		return fmt.Errorf("STORAGE_MULTIPART_PART_SIZE_BYTES cannot exceed STORAGE_MAX_UPLOAD_BYTES")
	}
	if len(cfg.Storage.AllowedMIMETypes) == 0 {
		return fmt.Errorf("STORAGE_ALLOWED_MIME_TYPES cannot be empty")
	}
	if cfg.Storage.SignedURLTTL <= 0 || cfg.Storage.UploadIntentTTL <= 0 || cfg.Storage.PlaybackGrantTTL <= 0 {
		return fmt.Errorf("storage TTL values must be positive")
	}
	decodedKey, err := base64.StdEncoding.DecodeString(cfg.Security.EncryptionKey)
	if err != nil {
		return fmt.Errorf("ENCRYPTION_KEY_BASE64 is not valid base64: %w", err)
	}
	if len(decodedKey) != 32 {
		return fmt.Errorf("ENCRYPTION_KEY_BASE64 must decode to exactly 32 bytes")
	}
	return nil
}
