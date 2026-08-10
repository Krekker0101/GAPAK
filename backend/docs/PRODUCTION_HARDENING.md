# GAPAK Backend — Production Hardening

## Scope

This document records the first production-hardening pass over the existing backend. The implementation preserves the existing module/service/repository architecture and focuses on correctness, security and failure behavior rather than adding product features.

## Implemented fixes

### P0 — refresh-token rotation race

Refresh rotation now uses an atomic compare-and-swap update keyed by the current refresh-token hash. Two concurrent uses of the same refresh token cannot both rotate the session. A failed CAS is treated as token replay/session invalidation.

### P0 — migration integrity

Applied migrations are now checked against both their stored name and SHA-256 checksum. If an already-applied migration was modified in the repository, startup/migration execution fails instead of silently accepting drift.

### P0 — production secret defaults

Production configuration rejects known insecure fallback secrets and requires secure cookies. The encryption key is validated as base64-encoded AES-256 material.

### P1 — Redis idempotency race

Idempotency reservation now uses atomic Redis `SET NX EX` semantics. Duplicate concurrent requests cannot both acquire the same idempotency key. Keys are length-limited and Redis failure is explicit when an idempotency key was requested.

### P1 — distributed rate-limit degradation

Authentication/password-sensitive endpoints fail closed when the Redis-backed distributed rate limiter is unavailable. Non-critical traffic may still use the existing bounded process-local fallback.

### P1 — WebSocket message path

WebSocket `message` frames now pass through the existing chat service, preserving chat membership and encrypted-message validation. The persisted message is broadcast only after successful persistence and the sender receives an acknowledgement.

WebSocket read receipts now use the existing chat service. Typing events now verify chat membership before broadcasting.

### P1 — WebSocket backpressure safety

Outbound WebSocket writes use bounded non-blocking enqueue operations. The connection registry no longer closes the shared send channel during unregister, avoiding send-on-closed-channel races between disconnect and broadcast paths.

## Deliberate non-changes

- No product features were removed.
- The backend was not rewritten.
- The existing PostgreSQL/Redis/worker/storage architecture was retained.
- Worker retry policy and HLS playback-session semantics require deeper schema-level validation before changing them safely.

## Verification

The repository environment used for this pass contains Go 1.23.2 while `go.mod` requires Go 1.24.13. Therefore the full Go build/test suite must be rerun in a Go 1.24.13 environment before claiming production readiness.

Recommended verification commands:

```text
gofmt -w .
go vet ./...
go test ./...
go test -race ./...
go build ./cmd/api
go build ./cmd/worker
go build ./cmd/migrate
go build ./cmd/admin
```

## Remaining risks

- Full integration/concurrency coverage is still below the level expected for a high-scale production service.
- The supplied archive previously contained a `.env` with credentials/secrets. That file has been removed from the working project; any credentials that were ever shared externally should be rotated.
- A complete production audit of OAuth state/PKCE, media/HLS authorization, worker retry/backoff and distributed realtime delivery should be performed in the next hardening stage.
