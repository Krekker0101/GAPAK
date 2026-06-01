package main

import (
	"context"
	"log"
	"os/signal"
	"syscall"

	"github.com/gapak/backend/internal/config"
	"github.com/gapak/backend/internal/platform/cache"
	"github.com/gapak/backend/internal/platform/database"
	"github.com/gapak/backend/internal/platform/logger"
	"github.com/gapak/backend/internal/platform/queue"
	"github.com/gapak/backend/internal/workers"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config load failed: %v", err)
	}

	appLogger := logger.New(cfg.App.Environment)

	db, err := database.NewPostgres(ctx, cfg.Database)
	if err != nil {
		log.Fatalf("postgres init failed: %v", err)
	}
	defer db.Close()

	redisClient, err := cache.NewRedis(ctx, cfg.Redis)
	if err != nil {
		appLogger.Warn().Err(err).Msg("redis is unavailable; worker will use database polling fallback")
		redisClient = nil
	}
	if redisClient != nil {
		defer redisClient.Close()
	}

	repo := workers.NewRepository(db)
	redisQueue := queue.NewRedisQueue(redisClient)
	runner := workers.NewRunner(cfg, appLogger, repo, redisQueue)

	if err := runner.Run(ctx); err != nil {
		log.Fatalf("worker exited with error: %v", err)
	}
}
