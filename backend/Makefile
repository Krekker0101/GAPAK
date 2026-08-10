APP_NAME=gapak-api
WORKER_NAME=gapak-worker
MIGRATE_NAME=gapak-migrate

.PHONY: tidy test race vet security build build-worker build-migrate run run-worker migrate docker-up integration fuzz chaos

tidy:
	go mod tidy

test:
	go test ./...

integration:
	GAPAK_INTEGRATION_DB_URL="$${GAPAK_INTEGRATION_DB_URL:?set GAPAK_INTEGRATION_DB_URL}" go test ./... -run Integration -count=1

fuzz:
	go test ./internal/platform/pagination ./internal/platform/auth ./internal/modules/media ./internal/services/websocket ./internal/platform/logger -run=^$ -fuzz=Fuzz -fuzztime=30s

chaos:
	@tests/chaos/run.sh help

race:
	go test -race ./...

vet:
	go vet ./...

security: vet test race
	govulncheck ./...
	@echo "Security checklist: secrets, dependency scan, migrations, auth replay, CSRF, IDOR, media and WebSocket regression tests must pass."

build:
	go build -o bin/$(APP_NAME) ./cmd/api

build-worker:
	go build -o bin/$(WORKER_NAME) ./cmd/worker

build-migrate:
	go build -o bin/$(MIGRATE_NAME) ./cmd/migrate

run:
	go run ./cmd/api

run-worker:
	go run ./cmd/worker

migrate:
	go run ./cmd/migrate

docker-up:
	docker compose up --build

.PHONY: bench bench-memory perf-sql

bench:
	go test ./... -run '^$' -bench . -benchmem

bench-memory:
	go test ./internal/platform/pagination ./internal/platform/auth ./internal/modules/posts -run '^$' -bench . -benchmem -count=5

perf-sql:
	@echo "Run perf/sql/EXPLAIN_FEEDS.sql against a production-like PostgreSQL dataset."
