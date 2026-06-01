package app

import (
	"context"
	"fmt"
	"time"

	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"
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
	"github.com/gapak/backend/internal/platform/database"
	"github.com/gapak/backend/internal/platform/httpx"
	"github.com/gapak/backend/internal/platform/logger"
	"github.com/gapak/backend/internal/platform/middleware"
	"github.com/gapak/backend/internal/platform/privacy"
	"github.com/gapak/backend/internal/platform/queue"
	"github.com/gapak/backend/internal/platform/storage"
)

type App struct {
	Config    config.Config
	Logger    zerolog.Logger
	Fiber     *fiber.App
	DB        *pgxpool.Pool
	Redis     *redis.Client
	Validate  *validator.Validate
	JWT       *authplatform.Manager
	Passwords *authplatform.PasswordManager
	TOTP      *authplatform.TOTPManager
	Encryptor *appcrypto.Encryptor
	Privacy   *privacy.Service
	Storage   storage.Service
	Queue     *queue.RedisQueue
}

type Dependencies struct {
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
	Queue           *queue.RedisQueue
	RolePermissions map[string][]string
}

func New(ctx context.Context) (*App, error) {
	cfg, err := config.Load()
	if err != nil {
		return nil, err
	}

	log := logger.New(cfg.App.Environment)

	db, err := database.NewPostgres(ctx, cfg.Database)
	if err != nil {
		return nil, fmt.Errorf("postgres init: %w", err)
	}

	// Apply migrations automatically
	migrationsDir := "db/migrations"
	if err := database.ApplyMigrations(ctx, db, migrationsDir); err != nil {
		return nil, fmt.Errorf("apply migrations: %w", err)
	}

	redisClient, err := cache.NewRedis(ctx, cfg.Redis)
	if err != nil {
		log.Warn().Err(err).Msg("redis is unavailable; starting in degraded mode")
		redisClient = nil
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
	storageSigner := storage.NewGatewaySigner(cfg.Storage)
	redisQueue := queue.NewRedisQueue(redisClient)
	privacyService := privacy.NewService(cfg.Anonymity)

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
	fiberApp.Use(requestid.New())
	fiberApp.Use(cors.New(cors.Config{
		AllowCredentials: true,
		AllowOrigins:     joinOrigins(cfg.App.CORSOrigins),
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization, X-CSRF-Token, X-Request-Id",
		ExposeHeaders:    "X-Request-Id",
	}))
	fiberApp.Use(helmet.New(helmet.Config{
		ContentSecurityPolicy: "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' https:; font-src 'self'",
	}))
	fiberApp.Use(middleware.RequestLogger(log, privacyService))
	fiberApp.Use(middleware.RateLimiter{
		Redis:  redisClient,
		Prefix: "rl:global",
		Max:    cfg.RateLimit.GlobalMax,
		Window: cfg.RateLimit.GlobalWindow,
		KeyFn:  privacyService.RateLimitKey,
	}.Handler())

	app := &App{
		Config:    cfg,
		Logger:    log,
		Fiber:     fiberApp,
		DB:        db,
		Redis:     redisClient,
		Validate:  validate,
		JWT:       jwtManager,
		Passwords: authplatform.NewPasswordManager(cfg.Security.PasswordPepper),
		TOTP:      authplatform.NewTOTPManager(cfg.App.Name, cfg.Security.TOTPWindow),
		Encryptor: encryptor,
		Privacy:   privacyService,
		Storage:   storageSigner,
		Queue:     redisQueue,
	}

	deps := Dependencies{
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
		Storage:         storageSigner,
		Queue:           redisQueue,
		RolePermissions: enums.RolePermissions,
	}

	registerBaseRoutes(fiberApp, deps)
	registerModules(fiberApp, deps)

	return app, nil
}

func (a *App) Run(ctx context.Context) error {
	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = a.Shutdown(shutdownCtx)
	}()

	address := fmt.Sprintf("%s:%s", a.Config.HTTP.Host, a.Config.HTTP.Port)
	return a.Fiber.Listen(address)
}

func (a *App) Shutdown(ctx context.Context) error {
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

func joinOrigins(origins []string) string {
	result := origins[0]
	for i := 1; i < len(origins); i++ {
		result += "," + origins[i]
	}
	return result
}
