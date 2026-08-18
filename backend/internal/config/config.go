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
	OAuth     OAuthConfig
	Anonymity AnonymityConfig
	Storage   StorageConfig
	Queue     QueueConfig
	Worker    WorkerConfig
	RateLimit RateLimitConfig
	Metrics   MetricsConfig
	Push      PushConfig
}

type AppConfig struct {
	Name        string
	Environment string
	BaseURL     string
	CORSOrigins []string
	AutoMigrate bool
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
	MaxConnIdleTime time.Duration
}

type RedisConfig struct {
	Enabled bool
	URL     string
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
	TOTPWindow        int
}

type OAuthProviderConfig struct {
	ClientID     string
	ClientSecret string
	AuthURL      string
	TokenURL     string
	UserInfoURL  string
	RedirectURI  string
	Scopes       []string
}

type OAuthConfig struct {
	Google              OAuthProviderConfig
	GitHub              OAuthProviderConfig
	Facebook            OAuthProviderConfig
	FrontendRedirectURL string
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
	FFmpegTimeout          time.Duration
	FFmpegMaxDuration      time.Duration
	FFmpegMaxOutputBytes   int64
	FFmpegThreads          int
	FFmpegConcurrency      int
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
	CleanupInterval         time.Duration
}

type MetricsConfig struct {
	Enabled bool
	Token   string
}

type PushConfig struct {
	Enabled      bool
	Providers    []string
	WebPush      WebPushConfig
	FCM          FCMConfig
	APNs         APNsConfig
	PollInterval time.Duration
	BatchSize    int
	MaxAttempts  int
	BaseRetry    time.Duration
	MaxRetry     time.Duration
}

type WebPushConfig struct {
	VAPIDSubject            string
	VAPIDPublicKeyBase64URL string
	VAPIDPrivateKeyPEM      string
	AudienceOverride        string
}

type FCMConfig struct {
	ProjectID     string
	ClientEmail   string
	PrivateKeyPEM string
	TokenEndpoint string
	APIBaseURL    string
}

type APNsConfig struct {
	TeamID        string
	KeyID         string
	PrivateKeyPEM string
	BundleID      string
	Production    bool
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
			CORSOrigins: getEnvSlice("CORS_ORIGINS", []string{"http://localhost:3000", "http://localhost:3002", "https://gapak.vercel.app"}),
			AutoMigrate: getEnvBool("AUTO_MIGRATE", false),
		},
		HTTP: HTTPConfig{
			Host:         getEnv("APP_HOST", "0.0.0.0"),
			Port:         getEnv("PORT", getEnv("APP_PORT", "8080")),
			ReadTimeout:  getEnvDuration("HTTP_READ_TIMEOUT", 15*time.Second),
			WriteTimeout: getEnvDuration("HTTP_WRITE_TIMEOUT", 15*time.Second),
			IdleTimeout:  getEnvDuration("HTTP_IDLE_TIMEOUT", 60*time.Second),
		},
		Database: DatabaseConfig{
			URL:             requireEnv("DATABASE_URL"),
			MaxOpenConns:    int32(getEnvInt("DATABASE_MAX_OPEN_CONNS", 20)),
			MinOpenConns:    int32(getEnvInt("DATABASE_MIN_OPEN_CONNS", 5)),
			MaxConnLifetime: getEnvDuration("DATABASE_MAX_CONN_LIFETIME", 30*time.Minute),
			MaxConnIdleTime: getEnvDuration("DATABASE_MAX_CONN_IDLE_TIME", 5*time.Minute),
		},
		Redis: RedisConfig{
			Enabled: getEnvBool("REDIS_ENABLED", false),
			URL:     getEnv("REDIS_URL", ""),
		},
		Security: SecurityConfig{
			JWTIssuer:         getEnv("JWT_ISSUER", "gapak.api"),
			JWTAudience:       getEnv("JWT_AUDIENCE", "gapak.clients"),
			JWTAccessSecret:   getEnv("JWT_ACCESS_SECRET", "default-jwt-access-secret-change-in-production-min-32-chars"),
			JWTRefreshSecret:  getEnv("JWT_REFRESH_SECRET", "default-jwt-refresh-secret-change-in-production-min-32-chars"),
			AccessTokenTTL:    getEnvDuration("JWT_ACCESS_TTL", 15*time.Minute),
			RefreshTokenTTL:   getEnvDuration("JWT_REFRESH_TTL", 30*24*time.Hour),
			PasswordPepper:    getEnv("PASSWORD_PEPPER", "default-password-pepper-change-in-production"),
			EncryptionKey:     getEnv("ENCRYPTION_KEY_BASE64", "YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY3ODk="),
			CookieDomain:      getEnvAllowEmpty("COOKIE_DOMAIN", "localhost"),
			CookieSecure:      getEnvBool("COOKIE_SECURE", false),
			CookieSameSite:    getEnv("COOKIE_SAME_SITE", "lax"),
			RefreshCookieName: getEnv("REFRESH_COOKIE_NAME", "gapak_rt"),
			TOTPWindow:        getEnvInt("TOTP_WINDOW", 1),
		},
		OAuth: OAuthConfig{
			Google: OAuthProviderConfig{
				ClientID:     getEnv("OAUTH_GOOGLE_CLIENT_ID", ""),
				ClientSecret: getEnv("OAUTH_GOOGLE_CLIENT_SECRET", ""),
				AuthURL:      "https://accounts.google.com/o/oauth2/v2/auth",
				TokenURL:     "https://oauth2.googleapis.com/token",
				UserInfoURL:  "https://www.googleapis.com/oauth2/v2/userinfo",
				RedirectURI:  getEnv("OAUTH_GOOGLE_REDIRECT_URI", strings.TrimRight(getEnv("APP_BASE_URL", "http://localhost:8080"), "/")+"/api/v1/auth/callback/google"),
				Scopes:       []string{"openid", "email", "profile"},
			},
			GitHub: OAuthProviderConfig{
				ClientID:     getEnv("OAUTH_GITHUB_CLIENT_ID", ""),
				ClientSecret: getEnv("OAUTH_GITHUB_CLIENT_SECRET", ""),
				AuthURL:      "https://github.com/login/oauth/authorize",
				TokenURL:     "https://github.com/login/oauth/access_token",
				UserInfoURL:  "https://api.github.com/user",
				RedirectURI:  getEnv("OAUTH_GITHUB_REDIRECT_URI", strings.TrimRight(getEnv("APP_BASE_URL", "http://localhost:8080"), "/")+"/api/v1/auth/callback/github"),
				Scopes:       []string{"user:email"},
			},
			Facebook: OAuthProviderConfig{
				ClientID:     getEnv("OAUTH_FACEBOOK_CLIENT_ID", ""),
				ClientSecret: getEnv("OAUTH_FACEBOOK_CLIENT_SECRET", ""),
				AuthURL:      "https://www.facebook.com/v19.0/dialog/oauth",
				TokenURL:     "https://graph.facebook.com/v19.0/oauth/access_token",
				UserInfoURL:  "https://graph.facebook.com/v19.0/me?fields=id,name,email",
				RedirectURI:  getEnv("OAUTH_FACEBOOK_REDIRECT_URI", strings.TrimRight(getEnv("APP_BASE_URL", "http://localhost:8080"), "/")+"/api/v1/auth/callback/facebook"),
				Scopes:       []string{"email", "public_profile"},
			},
			FrontendRedirectURL: getEnv("OAUTH_FRONTEND_REDIRECT_URL", ""),
		},
		Anonymity: AnonymityConfig{
			Enabled:                   getEnvBool("ANONYMITY_ENABLED", true),
			RequirePseudonymousSignup: getEnvBool("ANONYMITY_REQUIRE_PSEUDONYMOUS_SIGNUP", true),
			AllowAnonymousSignup:      getEnvBool("ANONYMITY_ALLOW_ANONYMOUS_SIGNUP", true),
			AllowEmailSignup:          getEnvBool("ANONYMITY_ALLOW_EMAIL_SIGNUP", false),
			AllowPasswordRecovery:     getEnvBool("ANONYMITY_ALLOW_PASSWORD_RECOVERY", false),
			TrustProxyHeaders:         getEnvBool("ANONYMITY_TRUST_PROXY_HEADERS", false),
			ProxyHeaders:              getEnvSlice("ANONYMITY_PROXY_HEADERS", []string{"CF-Connecting-IP", "X-Forwarded-For", "X-Real-IP"}),
			HashSecret:                getEnv("ANONYMITY_HASH_SECRET", "default-anonymity-hash-secret-change-in-production"),
			StoreIP:                   getEnvBool("ANONYMITY_STORE_IP", false),
			StoreUserAgent:            getEnvBool("ANONYMITY_STORE_USER_AGENT", false),
			StoreDeviceFingerprint:    getEnvBool("ANONYMITY_STORE_DEVICE_FINGERPRINT", false),
			LogNetworkMetadata:        getEnvBool("ANONYMITY_LOG_NETWORK_METADATA", false),
			ExposeEmailInResponses:    getEnvBool("ANONYMITY_EXPOSE_EMAIL_IN_RESPONSES", false),
		},
		Storage: StorageConfig{
			Provider:               getEnv("STORAGE_PROVIDER", "local"),
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
			SigningSecret:          getEnv("STORAGE_SIGNING_SECRET", "default-storage-signing-secret-change-in-production"),
			MultipartPartSizeBytes: getEnvInt64("STORAGE_MULTIPART_PART_SIZE_BYTES", 8*1024*1024),
			MaxUploadBytes:         getEnvInt64("STORAGE_MAX_UPLOAD_BYTES", 25*1024*1024),
			AllowedMIMETypes:       getEnvSlice("STORAGE_ALLOWED_MIME_TYPES", []string{"image/jpeg", "image/png", "image/webp", "video/mp4", "application/pdf"}),
			FFmpegTimeout:          getEnvDuration("MEDIA_FFMPEG_TIMEOUT", 20*time.Minute),
			FFmpegMaxDuration:      getEnvDuration("MEDIA_FFMPEG_MAX_DURATION", 2*time.Hour),
			FFmpegMaxOutputBytes:   getEnvInt64("MEDIA_FFMPEG_MAX_OUTPUT_BYTES", 1024*1024*1024),
			FFmpegThreads:          getEnvInt("MEDIA_FFMPEG_THREADS", 2),
			FFmpegConcurrency:      getEnvInt("MEDIA_FFMPEG_CONCURRENCY", 2),
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
			CleanupInterval:         getEnvDuration("WORKER_MEDIA_CLEANUP_INTERVAL", 30*time.Minute),
		},
		Metrics: MetricsConfig{Enabled: getEnvBool("METRICS_ENABLED", true), Token: getEnv("METRICS_TOKEN", "")},
		Push: PushConfig{
			Enabled:      getEnvBool("PUSH_ENABLED", true),
			Providers:    getEnvSlice("PUSH_PROVIDERS", nil),
			WebPush:      WebPushConfig{VAPIDSubject: getEnv("PUSH_WEBPUSH_VAPID_SUBJECT", ""), VAPIDPublicKeyBase64URL: getEnv("PUSH_WEBPUSH_VAPID_PUBLIC_KEY", ""), VAPIDPrivateKeyPEM: getEnv("PUSH_WEBPUSH_VAPID_PRIVATE_KEY_PEM", ""), AudienceOverride: getEnv("PUSH_WEBPUSH_AUDIENCE", "")},
			FCM:          FCMConfig{ProjectID: getEnv("PUSH_FCM_PROJECT_ID", ""), ClientEmail: getEnv("PUSH_FCM_CLIENT_EMAIL", ""), PrivateKeyPEM: getEnv("PUSH_FCM_PRIVATE_KEY_PEM", ""), TokenEndpoint: getEnv("PUSH_FCM_TOKEN_ENDPOINT", "https://oauth2.googleapis.com/token"), APIBaseURL: getEnv("PUSH_FCM_API_BASE_URL", "https://fcm.googleapis.com/v1/projects")},
			APNs:         APNsConfig{TeamID: getEnv("PUSH_APNS_TEAM_ID", ""), KeyID: getEnv("PUSH_APNS_KEY_ID", ""), PrivateKeyPEM: getEnv("PUSH_APNS_PRIVATE_KEY_PEM", ""), BundleID: getEnv("PUSH_APNS_BUNDLE_ID", ""), Production: getEnvBool("PUSH_APNS_PRODUCTION", true)},
			PollInterval: getEnvDuration("PUSH_WORKER_POLL_INTERVAL", 2*time.Second),
			BatchSize:    getEnvInt("PUSH_WORKER_BATCH_SIZE", 20),
			MaxAttempts:  getEnvInt("PUSH_WORKER_MAX_ATTEMPTS", 8),
			BaseRetry:    getEnvDuration("PUSH_WORKER_BASE_RETRY", 5*time.Second),
			MaxRetry:     getEnvDuration("PUSH_WORKER_MAX_RETRY", 30*time.Minute),
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

	if strings.TrimSpace(cfg.OAuth.FrontendRedirectURL) == "" && len(cfg.App.CORSOrigins) > 0 {
		cfg.OAuth.FrontendRedirectURL = strings.TrimRight(strings.TrimSpace(cfg.App.CORSOrigins[0]), "/") + "/"
	}

	if err := validate(cfg); err != nil {
		return Config{}, err
	}

	return cfg, nil
}

func containsOrigin(origins []string, target string) bool {
	target = strings.TrimRight(strings.TrimSpace(target), "/")
	for _, origin := range origins {
		if strings.EqualFold(strings.TrimRight(strings.TrimSpace(origin), "/"), target) {
			return true
		}
	}
	return false
}

func rejectInsecureProductionDefaults(cfg Config) error {
	checks := map[string]string{
		"JWT_ACCESS_SECRET":      cfg.Security.JWTAccessSecret,
		"JWT_REFRESH_SECRET":     cfg.Security.JWTRefreshSecret,
		"PASSWORD_PEPPER":        cfg.Security.PasswordPepper,
		"STORAGE_SIGNING_SECRET": cfg.Storage.SigningSecret,
		"ANONYMITY_HASH_SECRET":  cfg.Anonymity.HashSecret,
	}
	defaults := map[string]string{
		"JWT_ACCESS_SECRET":      "default-jwt-access-secret-change-in-production-min-32-chars",
		"JWT_REFRESH_SECRET":     "default-jwt-refresh-secret-change-in-production-min-32-chars",
		"PASSWORD_PEPPER":        "default-password-pepper-change-in-production",
		"STORAGE_SIGNING_SECRET": "default-storage-signing-secret-change-in-production",
		"ANONYMITY_HASH_SECRET":  "default-anonymity-hash-secret-change-in-production",
	}
	for key, value := range checks {
		if value == defaults[key] || strings.TrimSpace(value) == "" {
			return fmt.Errorf("%s must be explicitly configured in production", key)
		}
	}
	if cfg.Security.EncryptionKey == "YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY3ODk=" {
		return fmt.Errorf("ENCRYPTION_KEY_BASE64 must be explicitly configured in production")
	}
	if raw, ok := os.LookupEnv("CORS_ORIGINS"); !ok || strings.TrimSpace(raw) == "" {
		return fmt.Errorf("CORS_ORIGINS must be explicitly configured in production")
	}
	baseURL, err := url.Parse(cfg.App.BaseURL)
	if err != nil || !strings.EqualFold(baseURL.Scheme, "https") || baseURL.Host == "" {
		return fmt.Errorf("APP_BASE_URL must be an explicit HTTPS URL in production")
	}
	for _, origin := range cfg.App.CORSOrigins {
		parsed, err := url.Parse(origin)
		if err != nil || !strings.EqualFold(parsed.Scheme, "https") {
			return fmt.Errorf("CORS_ORIGINS must contain HTTPS origins in production")
		}
	}
	if !cfg.Security.CookieSecure {
		return fmt.Errorf("COOKIE_SECURE must be true in production")
	}
	if strings.EqualFold(cfg.Security.CookieSameSite, "none") && !cfg.Security.CookieSecure {
		return fmt.Errorf("COOKIE_SECURE must be true when COOKIE_SAME_SITE=none")
	}
	if requiresCrossSiteCookies(cfg.App.BaseURL, cfg.App.CORSOrigins) && !strings.EqualFold(cfg.Security.CookieSameSite, "none") {
		return fmt.Errorf("COOKIE_SAME_SITE must be none when production frontend and API origins are cross-site")
	}
	return nil
}

func requiresCrossSiteCookies(baseURL string, origins []string) bool {
	base, err := url.Parse(baseURL)
	if err != nil || base.Hostname() == "" {
		return false
	}
	baseSite := registrableSite(base.Hostname())
	for _, origin := range origins {
		parsed, err := url.Parse(origin)
		if err != nil || parsed.Hostname() == "" {
			continue
		}
		if registrableSite(parsed.Hostname()) != baseSite {
			return true
		}
	}
	return false
}

func registrableSite(host string) string {
	host = strings.Trim(strings.ToLower(host), ".")
	parts := strings.Split(host, ".")
	if len(parts) < 2 {
		return host
	}
	return parts[len(parts)-2] + "." + parts[len(parts)-1]
}

func getEnv(key, fallback string) string {
	value, ok := os.LookupEnv(key)
	if !ok || strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}

// getEnvAllowEmpty preserves an explicitly-empty value (e.g. COOKIE_DOMAIN="")
// instead of collapsing it into fallback like getEnv does. Only a genuinely
// unset variable uses the fallback.
func getEnvAllowEmpty(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
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
		part = strings.TrimRight(strings.TrimSpace(part), "/")
		if part != "" {
			result = append(result, part)
		}
	}
	if len(result) == 0 {
		return fallback
	}
	return result
}

func validateTypedEnvironment() error {
	ints := []string{
		"DATABASE_MAX_OPEN_CONNS", "DATABASE_MIN_OPEN_CONNS", "MEDIA_FFMPEG_CONCURRENCY", "MEDIA_FFMPEG_THREADS",
		"RATE_LIMIT_AUTH_MAX", "RATE_LIMIT_GLOBAL_MAX", "RATE_LIMIT_PASSWORD_MAX", "TOTP_WINDOW", "WORKER_BATCH_SIZE", "WORKER_MEDIA_CONCURRENCY", "PUSH_WORKER_BATCH_SIZE", "PUSH_WORKER_MAX_ATTEMPTS",
	}
	int64s := []string{"MEDIA_FFMPEG_MAX_OUTPUT_BYTES", "STORAGE_MAX_UPLOAD_BYTES", "STORAGE_MULTIPART_PART_SIZE_BYTES"}
	bools := []string{
		"ANONYMITY_ALLOW_ANONYMOUS_SIGNUP", "ANONYMITY_ALLOW_EMAIL_SIGNUP", "ANONYMITY_ALLOW_PASSWORD_RECOVERY", "ANONYMITY_ENABLED",
		"ANONYMITY_EXPOSE_EMAIL_IN_RESPONSES", "ANONYMITY_LOG_NETWORK_METADATA", "ANONYMITY_REQUIRE_PSEUDONYMOUS_SIGNUP", "ANONYMITY_STORE_DEVICE_FINGERPRINT",
		"ANONYMITY_STORE_IP", "ANONYMITY_STORE_USER_AGENT", "ANONYMITY_TRUST_PROXY_HEADERS", "AUTO_MIGRATE", "COOKIE_SECURE", "METRICS_ENABLED", "REDIS_ENABLED", "PUSH_ENABLED", "PUSH_APNS_PRODUCTION",
	}
	durations := []string{
		"DATABASE_MAX_CONN_IDLE_TIME", "DATABASE_MAX_CONN_LIFETIME", "HTTP_IDLE_TIMEOUT", "HTTP_READ_TIMEOUT", "HTTP_WRITE_TIMEOUT", "JWT_ACCESS_TTL", "JWT_REFRESH_TTL",
		"LIVE_REPLAY_RETENTION", "MEDIA_FFMPEG_MAX_DURATION", "MEDIA_FFMPEG_TIMEOUT", "QUEUE_CLAIM_TTL", "RATE_LIMIT_AUTH_WINDOW", "RATE_LIMIT_GLOBAL_WINDOW",
		"RATE_LIMIT_PASSWORD_WINDOW", "STORAGE_PLAYBACK_GRANT_TTL", "STORAGE_SIGNED_URL_TTL", "STORAGE_UPLOAD_INTENT_TTL", "STORY_DEFAULT_TTL",
		"WORKER_MEDIA_CLEANUP_INTERVAL", "WORKER_POLL_INTERVAL", "PUSH_WORKER_POLL_INTERVAL", "PUSH_WORKER_BASE_RETRY", "PUSH_WORKER_MAX_RETRY",
	}
	for _, key := range ints {
		if raw, ok := os.LookupEnv(key); ok && strings.TrimSpace(raw) != "" {
			if _, err := strconv.Atoi(strings.TrimSpace(raw)); err != nil {
				return fmt.Errorf("%s must be a valid integer: %w", key, err)
			}
		}
	}
	for _, key := range int64s {
		if raw, ok := os.LookupEnv(key); ok && strings.TrimSpace(raw) != "" {
			if _, err := strconv.ParseInt(strings.TrimSpace(raw), 10, 64); err != nil {
				return fmt.Errorf("%s must be a valid int64: %w", key, err)
			}
		}
	}
	for _, key := range bools {
		if raw, ok := os.LookupEnv(key); ok && strings.TrimSpace(raw) != "" {
			if _, err := strconv.ParseBool(strings.TrimSpace(raw)); err != nil {
				return fmt.Errorf("%s must be a valid boolean: %w", key, err)
			}
		}
	}
	for _, key := range durations {
		if raw, ok := os.LookupEnv(key); ok && strings.TrimSpace(raw) != "" {
			if _, err := time.ParseDuration(strings.TrimSpace(raw)); err != nil {
				return fmt.Errorf("%s must be a valid duration: %w", key, err)
			}
		}
	}
	return nil
}

func validate(cfg Config) error {
	if err := validateTypedEnvironment(); err != nil {
		return err
	}

	required := map[string]string{
		"DATABASE_URL": cfg.Database.URL,
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
	if cfg.Database.MaxConnLifetime <= 0 || cfg.Database.MaxConnIdleTime <= 0 {
		return fmt.Errorf("database connection lifetime/idle time must be positive")
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
	if strings.EqualFold(cfg.App.Environment, "production") {
		if cfg.App.AutoMigrate {
			return fmt.Errorf("AUTO_MIGRATE must be false in production; run migrations as a separate release step")
		}
		if cfg.Metrics.Enabled && strings.TrimSpace(cfg.Metrics.Token) == "" {
			return fmt.Errorf("METRICS_TOKEN must be configured when metrics are enabled in production")
		}
		if err := rejectInsecureProductionDefaults(cfg); err != nil {
			return err
		}
		if !cfg.Redis.Enabled || strings.TrimSpace(cfg.Redis.URL) == "" {
			return fmt.Errorf("REDIS_ENABLED=true and REDIS_URL must be configured in production")
		}
	}
	key, err := base64.StdEncoding.DecodeString(cfg.Security.EncryptionKey)
	if err != nil || len(key) != 32 {
		return fmt.Errorf("ENCRYPTION_KEY_BASE64 must be valid base64 encoding of exactly 32 bytes")
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
	frontendRedirect, err := url.Parse(cfg.OAuth.FrontendRedirectURL)
	if err != nil || frontendRedirect.Host == "" || (frontendRedirect.Path != "/" && frontendRedirect.Path != "") || frontendRedirect.RawQuery != "" || frontendRedirect.Fragment != "" {
		return fmt.Errorf("OAUTH_FRONTEND_REDIRECT_URL must be a valid frontend origin URL")
	}
	if strings.EqualFold(cfg.App.Environment, "production") && !strings.EqualFold(frontendRedirect.Scheme, "https") {
		return fmt.Errorf("OAUTH_FRONTEND_REDIRECT_URL must use HTTPS in production")
	}
	if !containsOrigin(cfg.App.CORSOrigins, strings.TrimRight(cfg.OAuth.FrontendRedirectURL, "/")) {
		return fmt.Errorf("OAUTH_FRONTEND_REDIRECT_URL must match an allowed CORS origin")
	}
	for name, provider := range map[string]OAuthProviderConfig{
		"google":   cfg.OAuth.Google,
		"github":   cfg.OAuth.GitHub,
		"facebook": cfg.OAuth.Facebook,
	} {
		if err := validateOAuthProvider(name, provider, strings.EqualFold(cfg.App.Environment, "production")); err != nil {
			return err
		}
	}
	if strings.EqualFold(cfg.App.Environment, "production") && strings.TrimSpace(cfg.Security.CookieDomain) != "" {
		return fmt.Errorf("COOKIE_DOMAIN must be empty in production for the Vercel-to-Railway cross-site deployment")
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
	if cfg.Push.BatchSize <= 0 || cfg.Push.BatchSize > 500 {
		return fmt.Errorf("PUSH_WORKER_BATCH_SIZE must be between 1 and 500")
	}
	if cfg.Push.MaxAttempts < 1 || cfg.Push.MaxAttempts > 100 {
		return fmt.Errorf("PUSH_WORKER_MAX_ATTEMPTS must be between 1 and 100")
	}
	if cfg.Push.BaseRetry <= 0 || cfg.Push.MaxRetry < cfg.Push.BaseRetry {
		return fmt.Errorf("invalid push retry configuration")
	}
	if cfg.Push.Enabled {
		for _, provider := range cfg.Push.Providers {
			switch strings.ToLower(strings.TrimSpace(provider)) {
			case "webpush":
				if cfg.Push.WebPush.VAPIDSubject == "" || cfg.Push.WebPush.VAPIDPrivateKeyPEM == "" {
					return fmt.Errorf("webpush provider requires VAPID subject and private key")
				}
			case "fcm":
				if cfg.Push.FCM.ProjectID == "" || cfg.Push.FCM.ClientEmail == "" || cfg.Push.FCM.PrivateKeyPEM == "" {
					return fmt.Errorf("fcm provider requires project id, client email and private key")
				}
			case "apns":
				if cfg.Push.APNs.TeamID == "" || cfg.Push.APNs.KeyID == "" || cfg.Push.APNs.PrivateKeyPEM == "" || cfg.Push.APNs.BundleID == "" {
					return fmt.Errorf("apns provider requires team id, key id, private key and bundle id")
				}
			default:
				return fmt.Errorf("unsupported PUSH_PROVIDERS value: %s", provider)
			}
		}
	}
	return nil
}

func validateOAuthProvider(name string, provider OAuthProviderConfig, production bool) error {
	clientID := strings.TrimSpace(provider.ClientID)
	clientSecret := strings.TrimSpace(provider.ClientSecret)
	if clientID == "" {
		if clientSecret != "" {
			return fmt.Errorf("OAUTH_%s_CLIENT_ID is required when its client secret is configured", strings.ToUpper(name))
		}
		return nil
	}
	if clientSecret == "" {
		return fmt.Errorf("OAUTH_%s_CLIENT_SECRET is required when the provider is enabled", strings.ToUpper(name))
	}
	for field, raw := range map[string]string{
		"AUTH_URL":      provider.AuthURL,
		"TOKEN_URL":     provider.TokenURL,
		"USER_INFO_URL": provider.UserInfoURL,
		"REDIRECT_URI":  provider.RedirectURI,
	} {
		parsed, err := url.Parse(strings.TrimSpace(raw))
		if err != nil || parsed.Scheme == "" || parsed.Host == "" || parsed.User != nil || parsed.Fragment != "" {
			return fmt.Errorf("OAUTH_%s_%s must be a valid absolute URL without credentials or fragments", strings.ToUpper(name), field)
		}
		if production && !strings.EqualFold(parsed.Scheme, "https") {
			return fmt.Errorf("OAUTH_%s_%s must use HTTPS in production", strings.ToUpper(name), field)
		}
	}
	return nil
}
