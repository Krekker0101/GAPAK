# Testing / Reliability Hardening Report

## Implemented

- Added fuzz targets for pagination, JWT parsing, media upload normalization, WebSocket sequence parsing and log sanitization.
- Added invariant tests for chat metadata round-trip and safe update-column validation.
- Added deterministic username-base invariant tests.
- Added controlled-chaos scenario matrix covering worker crash, Redis outage, DB latency, duplicate requests, commit-before-response timeout, crash-after-persist, WebSocket reconnect and worker relay crash.
- Added a failure-mode catalog and testing matrix.
- Added `make integration`, `make fuzz` and `make chaos` targets.
- Added a CI fuzz smoke gate.
- Preserved the existing integration tests for worker lease fencing and WebSocket connection concurrency.

## Verification limitation

The repository requires Go 1.24.13. The execution environment contains an older Go launcher and attempted to download the required toolchain from `proxy.golang.org`, but outbound network/DNS is unavailable. Therefore the new Go tests could be formatted but not compiled or executed here. No test result is represented as passing unless it was actually executed.

## Required release commands

```text
gofmt -l .
go vet ./...
go test ./...
go test -race ./...
go test ./internal/platform/pagination ./internal/platform/auth ./internal/modules/media ./internal/services/websocket ./internal/platform/logger -run=^$ -fuzz=Fuzz -fuzztime=30s
go build ./cmd/api
go build ./cmd/worker
go build ./cmd/migrate
GAPAK_INTEGRATION_DB_URL=... go test ./... -run Integration -count=1
```

Then run the isolated chaos scenarios from `tests/chaos/README.md`.
