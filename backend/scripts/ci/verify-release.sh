#!/bin/sh
set -eu

test -z "$(gofmt -l .)"
go vet ./...
go test ./...
go test -race ./...
go test ./internal/platform/pagination ./internal/platform/auth ./internal/modules/media ./internal/services/websocket ./internal/platform/logger -run=^$ -fuzz=Fuzz -fuzztime=10s
go test ./internal/platform/database -run 'Migration|migration' -count=1
./scripts/ci/build.sh
