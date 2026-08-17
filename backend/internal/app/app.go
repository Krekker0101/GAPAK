package app

import (
	"context"
	"fmt"
	"net"
	"os"
	"strings"
	"time"

	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/compress"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/gofiber/fiber/v2/middleware/requestid"
	"github.com/gofiber/helmet/v2"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog"

	"github.com/gapak/backend/internal/config"
	"github.com/gapak/backend/internal/domain/enums"
	authplatform "github.com/gapak/backend/internal/platform/auth"
	"github.com/gapak/backend/internal/platform/cache"
	appcrypto "github.com/gapak/backend/internal/platform/crypto"
	"github.com/gapak/backend/internal/platform/csrf"
	"github.com/gapak/backend/internal/platform/database"
	"github.com/gapak/backend/internal/platform/httpx"
	"github.com/gapak/backend/internal/platform/logger"
	"github.com/gapak/backend/internal/platform/middleware"
	"github.com/gapak/backend/internal/platform/observability"
	"github.com/gapak/backend/internal/platform/privacy"
	"github.com/gapak/backend/internal/platform/queue"
	"github.com/gapak/backend/internal/platform/storage"
	"github.com/gapak/backend/internal/services/websocket"
)

type App struct {
	Observability *observability.Registry
	Config        config.Config
	Logger        zerolog.Logger
	Fiber         *fiber.App
	DB            *pgxpool.Pool
	Redis         *redis.Client
	Validate      *validator.Validate
	JWT           *authplatform.Manager
	Passwords     *authplatform.PasswordManager
	TOTP          *authplatform.TOTPManager
	Encryptor     *appcrypto.Encryptor
	Privacy       *privacy.Service
	Storage       storage.Service
	ObjectStore   storage.ObjectStore
	Queue         *queue.RedisQueue
	CSRF          csrf.Store
	WebSocket     *websocket.Service
}

type Dependencies struct {
	Observability   *observability.Registry
	Config          config.Config
	Logger          zerolog.Logger
	DB              *pgxpool.Pool
	Redis           *redis.Client
	Validate        *validator.Validate
	JWT             *authplatform.Manager
	Passwords       *authplatform.PasswordManager
	TOTP            *authplatform.TOTPManager
	Encryptor       *appcrypto.Encryptor
	Privacy         *privacy.Service
	Storage         storage.Service
	ObjectStore     storage.ObjectStore
	Queue           *queue.RedisQueue
	RolePermissions map[string][]string
	CSRF            csrf.Store
}

func New(ctx context.Context) (*App, error) {
	cfg, err := config.Load()
	if err != nil {
		return nil, err
	}

	log := logger.New(cfg.App.Environment)
	obs := observability.NewRegistry()
	log.Info().Str("component", "startup").Str("environment", cfg.App.Environment).Str("app", cfg.App.Name).Msg("application startup diagnostics")

	db, err := database.NewPostgres(ctx, cfg.Database, obs)
	if err != nil {
		return nil, fmt.Errorf("postgres init: %w", err)
	}

	// Migrations are normally deployed as a separate, explicitly controlled
	// release step. Keeping them out of API startup avoids surprise DDL locks
	// and makes rollback/deploy ordering deterministic.
	if cfg.App.AutoMigrate {
		if strings.EqualFold(cfg.App.Environment, "production") {
			db.Close()
			return nil, fmt.Errorf("AUTO_MIGRATE must be false in production; run gapak-migrate as a release step")
		}
		if err := database.ApplyMigrations(ctx, db, "db/migrations"); err != nil {
			db.Close()
			return nil, fmt.Errorf("apply migrations: %w", err)
		}
	}

	var redisClient *redis.Client
	if cfg.Redis.Enabled && strings.TrimSpace(cfg.Redis.URL) != "" {
		var err error
		redisClient, err = cache.NewRedis(ctx, cfg.Redis, obs)
		if err != nil {
			if strings.EqualFold(cfg.App.Environment, "production") {
				db.Close()
				return nil, fmt.Errorf("redis init: %w", err)
			}
			log.Warn().Err(err).Msg("redis is unavailable; starting in degraded mode")
			redisClient = nil
		}
	}

	encryptor, err := appcrypto.NewEncryptor(cfg.Security.EncryptionKey)
	if err != nil {
		if redisClient != nil {
			_ = redisClient.Close()
		}
		db.Close()
		return nil, fmt.Errorf("encryption init: %w", err)
	}

	validate := validator.New()
	jwtManager := authplatform.NewJWTManager(authplatform.JWTConfig{
		Issuer:        cfg.Security.JWTIssuer,
		Audience:      cfg.Security.JWTAudience,
		AccessSecret:  cfg.Security.JWTAccessSecret,
		RefreshSecret: cfg.Security.JWTRefreshSecret,
		AccessTTL:     cfg.Security.AccessTokenTTL,
		RefreshTTL:    cfg.Security.RefreshTokenTTL,
	})
	if redisClient != nil {
		jwtManager.SetRevocationChecker(authplatform.NewRedisRevocationChecker(redisClient))
	}
	storageProvider, objectStore, err := newStorageProvider(cfg.Storage)
	if err != nil {
		if redisClient != nil {
			_ = redisClient.Close()
		}
		db.Close()
		return nil, fmt.Errorf("storage init: %w", err)
	}
	redisQueue := queue.NewRedisQueue(redisClient)
	privacyService := privacy.NewService(cfg.Anonymity)
	var csrfStore csrf.Store = csrf.NewMemoryStore()
	if redisClient != nil {
		csrfStore = csrf.NewRedisStore(redisClient)
	}

	fiberApp := fiber.New(fiber.Config{
		AppName:               cfg.App.Name,
		BodyLimit:             int(cfg.Storage.MaxUploadBytes),
		ReadTimeout:           cfg.HTTP.ReadTimeout,
		WriteTimeout:          cfg.HTTP.WriteTimeout,
		IdleTimeout:           cfg.HTTP.IdleTimeout,
		DisableStartupMessage: cfg.App.Environment != "development",
		ErrorHandler:          httpx.FiberErrorHandler(log),
	})

	fiberApp.Use(recover.New())
	// Compress JSON/text responses to reduce bandwidth and serialization pressure.
	fiberApp.Use(compress.New(compress.Config{Level: compress.LevelBestSpeed}))
	fiberApp.Use(requestid.New())
	fiberApp.Use(middleware.ObservabilityContext())
	fiberApp.Use(cors.New(cors.Config{
		AllowCredentials: true,
		AllowOrigins:     joinOrigins(cfg.App.CORSOrigins),
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization, X-CSRF-Token, X-Idempotency-Key, X-Request-Id",
		AllowMethods:     "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS",
		ExposeHeaders:    "X-Request-Id, X-Next-Cursor",
		MaxAge:           600,
	}))
	// Browser-originated unsafe mutations must carry the CSRF header. Server-to-server
	// requests without an Origin remain possible; unknown browser origins are rejected.
	fiberApp.Use(middleware.BrowserMutationCSRF(csrfStore, jwtManager, cfg.Security, cfg.App.CORSOrigins...))
	fiberApp.Use(helmet.New(helmet.Config{
		ContentSecurityPolicy: "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' https:; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
	}))
	fiberApp.Use(middleware.SecurityHeaders(63072000))
	fiberApp.Use(middleware.RequestLogger(log, privacyService, obs))
	fiberApp.Use(middleware.Idempotency(redisClient, db, jwtManager))
	fiberApp.Use(middleware.RateLimiter{
		Redis:   redisClient,
		Prefix:  "rl:global",
		Metrics: obs,
		Max:     cfg.RateLimit.GlobalMax,
		Window:  cfg.RateLimit.GlobalWindow,
		KeyFn:   privacyService.RateLimitKey,
	}.Handler())

	database.StartPoolMetrics(ctx, db, obs)

	app := &App{
		Observability: obs,
		Config:        cfg,
		Logger:        log,
		Fiber:         fiberApp,
		DB:            db,
		Redis:         redisClient,
		Validate:      validate,
		JWT:           jwtManager,
		Passwords:     authplatform.NewPasswordManager(cfg.Security.PasswordPepper),
		TOTP:          authplatform.NewTOTPManager(cfg.App.Name, cfg.Security.TOTPWindow),
		Encryptor:     encryptor,
		Privacy:       privacyService,
		Storage:       storageProvider,
		ObjectStore:   objectStore,
		Queue:         redisQueue,
		CSRF:          csrfStore,
	}

	deps := Dependencies{
		Observability:   obs,
		Config:          cfg,
		Logger:          log,
		DB:              db,
		Redis:           redisClient,
		Validate:        validate,
		JWT:             jwtManager,
		Passwords:       app.Passwords,
		TOTP:            app.TOTP,
		Encryptor:       encryptor,
		Privacy:         privacyService,
		Storage:         storageProvider,
		ObjectStore:     objectStore,
		Queue:           redisQueue,
		CSRF:            csrfStore,
		RolePermissions: enums.RolePermissions,
	}

	registerBaseRoutes(fiberApp, deps)
	wsService := registerModules(fiberApp, deps)
	wsService.Start(ctx)
	app.WebSocket = wsService

	return app, nil
}

func (a *App) Run(ctx context.Context) error {
	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = a.Shutdown(shutdownCtx)
	}()

	// Vercel and many PaaS providers expose the target port in the PORT env var.
	// Keep APP_PORT as the explicit override, but fall back to PORT so the
	// container/serverless runtime can bind correctly.
	port := a.Config.HTTP.Port
	if port == "" {
		port = os.Getenv("PORT")
	}
	if port == "" {
		port = "8080"
	}
	host := a.Config.HTTP.Host
	if host == "" {
		host = "0.0.0.0"
	}

	return a.Fiber.Listen(net.JoinHostPort(host, port))
}

func (a *App) Shutdown(ctx context.Context) error {
	if a.WebSocket != nil {
		a.WebSocket.Stop(ctx)
	}
	var shutdownErr error
	if a.Fiber != nil {
		shutdownErr = a.Fiber.ShutdownWithContext(ctx)
	}
	if a.Redis != nil {
		_ = a.Redis.Close()
	}
	if a.DB != nil {
		a.DB.Close()
	}
	return shutdownErr
}

func newStorageProvider(cfg config.StorageConfig) (storage.Service, storage.ObjectStore, error) {
	provider := strings.ToLower(strings.TrimSpace(cfg.Provider))
	switch provider {
	case "", "local":
		local := storage.NewLocalStorage(cfg)
		return local, local, nil
	case "s3", "minio":
		s3, err := storage.NewS3Storage(cfg)
		if err != nil {
			return nil, nil, err
		}
		return s3, s3, nil
	default:
		return nil, nil, fmt.Errorf("unsupported storage provider: %s", cfg.Provider)
	}
}

func joinOrigins(origins []string) string {
	result := origins[0]
	for i := 1; i < len(origins); i++ {
		result += "," + origins[i]
	}
	return result
}
