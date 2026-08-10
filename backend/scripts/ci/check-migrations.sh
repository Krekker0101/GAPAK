#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
export MIGRATIONS_DIR="${MIGRATIONS_DIR:-db/migrations}"

echo "Checking migration set and applying to a clean database..."
go run ./cmd/migrate

echo "Re-running migrations to verify idempotency and checksum integrity..."
go run ./cmd/migrate

echo "Migration check passed."
