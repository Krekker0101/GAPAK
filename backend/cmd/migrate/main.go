package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"github.com/gapak/backend/internal/config"
	"github.com/gapak/backend/internal/platform/database"
	"github.com/gapak/backend/internal/platform/version"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	log.SetOutput(os.Stdout)

	if version.Commit == "unknown" {
		if commit := strings.TrimSpace(os.Getenv("RAILWAY_GIT_COMMIT_SHA")); commit != "" {
			version.Commit = commit
		}
	}
	if version.Version == "dev" {
		if branch := strings.TrimSpace(os.Getenv("RAILWAY_GIT_BRANCH")); branch != "" {
			version.Version = branch
		}
	}

	log.Printf("gapak startup version=%s commit=%s build_time=%s", version.Version, version.Commit, version.BuildTime)
	migrationsDir := migrationDirectory()
	migrations, err := database.LoadMigrations(migrationsDir)
	if err != nil {
		log.Fatalf("migration files validation failed: %v", err)
	}
	log.Printf("validated %d migration files from %s", len(migrations), migrationsDir)

	log.Printf("loading migration database configuration")
	dbCfg, err := config.LoadDatabase()
	if err != nil {
		log.Fatalf("migration database config failed: %v", err)
	}

	log.Printf("connecting to PostgreSQL")
	db, err := database.NewPostgres(ctx, dbCfg, nil)
	if err != nil {
		log.Fatalf("migration PostgreSQL connection failed: %v", err)
	}
	defer db.Close()

	if err := database.ApplyMigrations(ctx, db, migrationsDir); err != nil {
		log.Fatalf("migration failed: %v", err)
	}

	log.Printf("migrations applied successfully from %s", migrationsDir)
}

func migrationDirectory() string {
	if configured := os.Getenv("MIGRATIONS_DIR"); configured != "" {
		return configured
	}
	const containerDir = "/app/db/migrations"
	if info, err := os.Stat(containerDir); err == nil && info.IsDir() {
		return containerDir
	}
	return "db/migrations"
}
