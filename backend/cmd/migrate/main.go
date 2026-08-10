package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/gapak/backend/internal/config"
	"github.com/gapak/backend/internal/platform/database"
	"github.com/gapak/backend/internal/platform/version"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	log.Printf("gapak startup version=%s commit=%s build_time=%s", version.Version, version.Commit, version.BuildTime)

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config load failed: %v", err)
	}

	db, err := database.NewPostgres(ctx, cfg.Database, nil)
	if err != nil {
		log.Fatalf("postgres init failed: %v", err)
	}
	defer db.Close()

	migrationsDir := os.Getenv("MIGRATIONS_DIR")
	if migrationsDir == "" {
		migrationsDir = "db/migrations"
	}

	if err := database.ApplyMigrations(ctx, db, migrationsDir); err != nil {
		log.Fatalf("migration failed: %v", err)
	}

	log.Printf("migrations applied successfully from %s", migrationsDir)
}
