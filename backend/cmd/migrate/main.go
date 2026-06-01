package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/gapak/backend/internal/config"
	"github.com/gapak/backend/internal/platform/database"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config load failed: %v", err)
	}

	db, err := database.NewPostgres(ctx, cfg.Database)
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
