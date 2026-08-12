package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/gapak/backend/internal/config"
	"github.com/gapak/backend/internal/platform/cache"
	"github.com/gapak/backend/internal/platform/database"
	"github.com/gapak/backend/internal/platform/logger"
	"github.com/gapak/backend/internal/platform/observability"
	"github.com/gapak/backend/internal/platform/queue"
	"github.com/gapak/backend/internal/platform/storage"
	"github.com/gapak/backend/internal/platform/version"
	"github.com/gapak/backend/internal/workers"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	log.Printf("gapak startup version=%s commit=%s build_time=%s", version.Version, version.Commit, version.BuildTime)

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config load failed: %v", err)
	}

	appLogger := logger.New(cfg.App.Environment)
	obs := observability.NewRegistry()

	db, err := database.NewPostgres(ctx, cfg.Database, obs)
	if err != nil {
		log.Fatalf("postgres init failed: %v", err)
	}
	defer db.Close()
	database.StartPoolMetrics(ctx, db, obs)

	redisClient, err := cache.NewRedis(ctx, cfg.Redis, obs)
	if err != nil {
		if strings.EqualFold(cfg.App.Environment, "production") {
			db.Close()
			log.Fatalf("redis init failed in production: %v", err)
		}
		appLogger.Warn().Err(err).Msg("redis is unavailable; worker will use database polling fallback")
		redisClient = nil
	}
	if redisClient != nil {
		defer redisClient.Close()
	}

	repo := workers.NewRepository(db)
	redisQueue := queue.NewRedisQueue(redisClient)
	var objectStore storage.ObjectStore
	switch cfg.Storage.Provider {
	case "", "local":
		objectStore = storage.NewLocalStorage(cfg.Storage)
	case "s3", "minio":
		s3, err := storage.NewS3Storage(cfg.Storage)
		if err != nil {
			log.Fatalf("storage init failed: %v", err)
		}
		objectStore = s3
	default:
		log.Fatalf("unsupported storage provider: %s", cfg.Storage.Provider)
	}
	server := &http.Server{Addr: workerHTTPAddr(cfg), Handler: workerHTTPHandler(obs)}
	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			appLogger.Error().Err(err).Msg("worker metrics server failed")
		}
	}()
	defer func() {
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = server.Shutdown(shutdownCtx)
	}()

	runner := workers.NewRunner(cfg, appLogger, repo, redisQueue, objectStore, obs)

	if err := runner.Run(ctx); err != nil {
		log.Fatalf("worker exited with error: %v", err)
	}
}

func workerHTTPAddr(cfg config.Config) string {
	if port := strings.TrimSpace(os.Getenv("PORT")); port != "" {
		return ":" + port
	}
	if port := strings.TrimSpace(os.Getenv("WORKER_METRICS_PORT")); port != "" {
		return "127.0.0.1:" + port
	}
	return "127.0.0.1:" + cfg.HTTP.Port
}

func workerHTTPHandler(obs *observability.Registry) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/health/live", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok","component":"worker"}`))
	})
	mux.HandleFunc("/health/ready", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ready","component":"worker"}`))
	})
	mux.Handle("/metrics", obs)
	return mux
}
