# GAPAK Backend — Final Architecture Review

## Scope

This document is the independent final review of the repository after the hardening passes. It treats the current source tree as untrusted and evaluates the actual implementation, not prior reports.

## Runtime shape

- `cmd/api`: HTTP API, authentication, authorization, WebSocket gateway, module wiring.
- `cmd/worker`: durable PostgreSQL-backed job processing with Redis Streams as a dispatch/fast path and lease fencing in PostgreSQL.
- `cmd/migrate`: explicit migration runner protected by a PostgreSQL advisory lock and migration checksums.
- PostgreSQL: durable source of truth for identity, sessions, social state, chat state, media metadata, processing jobs and realtime outbox state.
- Redis: distributed rate limiting, revocation, idempotency reservation, realtime fanout and worker dispatch.
- Object storage: local filesystem for development and S3-compatible storage for deployments that configure it.
- FFmpeg/ffprobe: bounded media processing in workers.

## Architectural invariants

1. PostgreSQL is the source of truth for durable state.
2. Redis loss must not silently authorize security-sensitive operations.
3. Refresh-token rotation is compare-and-swap based.
4. Chat sequence numbers are allocated by a row-serialized database update.
5. Chat message persistence, envelopes, attachments, receipts and realtime outbox are committed in one transaction.
6. Object-level authorization lives in service/repository paths, not only in HTTP routing.
7. Signed media URLs are capabilities; HLS playlists are rewritten to signed object URLs for the same playback grant.
8. Worker completion is fenced by a lease token.
9. Production migrations are an explicit release step; API startup no longer performs DDL implicitly.
10. Production startup rejects insecure/default secrets and requires explicit critical dependencies.

## Important architectural boundaries

- HTTP handlers bind/validate input and extract identity.
- Services enforce business authorization and state transitions.
- Repositories enforce durable invariants and transaction boundaries.
- Redis is never treated as the authoritative copy of chat/job state.
- Realtime delivery is at-least-once and recoverable from PostgreSQL sequence/outbox state.
