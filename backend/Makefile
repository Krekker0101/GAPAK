APP_NAME=gapak-api
WORKER_NAME=gapak-worker
MIGRATE_NAME=gapak-migrate

.PHONY: tidy test build build-worker build-migrate run run-worker migrate docker-up

tidy:
	go mod tidy

test:
	go test ./...

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
