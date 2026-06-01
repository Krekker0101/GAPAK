package database

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Migration struct {
	Version  string
	Name     string
	Path     string
	SQL      string
	Checksum string
}

func ApplyMigrations(ctx context.Context, db *pgxpool.Pool, dir string) error {
	if db == nil {
		return fmt.Errorf("database pool is nil")
	}

	if err := ensureMigrationTable(ctx, db); err != nil {
		return err
	}

	migrations, err := LoadMigrations(dir)
	if err != nil {
		return err
	}

	for _, migration := range migrations {
		applied, err := isMigrationApplied(ctx, db, migration.Version)
		if err != nil {
			return err
		}
		if applied {
			continue
		}

		tx, err := db.Begin(ctx)
		if err != nil {
			return err
		}

		if _, err := tx.Exec(ctx, migration.SQL); err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("apply migration %s: %w", migration.Version, err)
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO schema_migrations (version, name, checksum)
			VALUES ($1, $2, $3)
		`, migration.Version, migration.Name, migration.Checksum); err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("record migration %s: %w", migration.Version, err)
		}
		if err := tx.Commit(ctx); err != nil {
			return err
		}
	}

	return nil
}

func LoadMigrations(dir string) ([]Migration, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("read migrations dir %s: %w", dir, err)
	}

	migrations := make([]Migration, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		if filepath.Ext(entry.Name()) != ".sql" {
			continue
		}

		fullPath := filepath.Join(dir, entry.Name())
		content, err := os.ReadFile(fullPath)
		if err != nil {
			return nil, fmt.Errorf("read migration %s: %w", fullPath, err)
		}

		version, name := parseMigrationName(entry.Name())
		checksum := sha256.Sum256(content)

		migrations = append(migrations, Migration{
			Version:  version,
			Name:     name,
			Path:     fullPath,
			SQL:      string(content),
			Checksum: hex.EncodeToString(checksum[:]),
		})
	}

	sort.Slice(migrations, func(i, j int) bool {
		return migrations[i].Version < migrations[j].Version
	})

	return migrations, nil
}

func ensureMigrationTable(ctx context.Context, db *pgxpool.Pool) error {
	_, err := db.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			checksum TEXT NOT NULL,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`)
	return err
}

func isMigrationApplied(ctx context.Context, db *pgxpool.Pool, version string) (bool, error) {
	var exists bool
	err := db.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE version = $1)`, version).Scan(&exists)
	return exists, err
}

func parseMigrationName(fileName string) (string, string) {
	base := strings.TrimSuffix(fileName, filepath.Ext(fileName))
	parts := strings.SplitN(base, "_", 2)
	if len(parts) == 1 {
		return parts[0], parts[0]
	}
	return parts[0], parts[1]
}
