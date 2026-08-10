# GAPAK Backend — Testing Strategy

## Goal

The objective is not maximum line coverage. The objective is confidence in critical invariants, security boundaries, concurrency, recovery and failure semantics.

## Testing pyramid

| Layer | Scope | Gate |
|---|---|---|
| Unit | validators, parsers, crypto adapters, state helpers | every PR |
| Repository | SQL scanners, repository invariants, migration loader | every PR + integration |
| Integration | Postgres/Redis/MinIO interactions | pre-merge when dependencies available |
| API | Fiber route semantics, auth/error/status contracts | pre-merge |
| Database | constraints, locking, migrations, concurrent state transitions | release |
| Redis | atomicity, outage, TTL and queue semantics | release |
| WebSocket | auth, subscriptions, backpressure, ordering, recovery | release |
| Worker | lease fencing, retries, crash/reclaim, dead jobs | release |
| Security regression | IDOR, replay, CSRF, OAuth, upload, secret leakage | every security change |
| Concurrency | 2/100 concurrent callers, duplicate requests, races | release |
| E2E | critical user journeys across API/DB/Redis/MinIO | release |
| Failure injection | partial failures and recovery | release + incident drills |

## Critical invariants

1. A refresh token can be successfully rotated only once.
2. A reclaimed worker job cannot be completed by a stale lease holder.
3. A chat `client_message_id` is idempotent within `(chat, sender)`.
4. Chat sequence numbers are durable and monotonic per conversation.
5. Redis is transport/cache, never the only source of durable state.
6. WebSocket replay after reconnect is recoverable from durable state.
7. A one-time media view is consumed once per playback session, not once per HLS segment.
8. Authorization is enforced at the service/repository boundary, not only in HTTP handlers.
9. Security-sensitive errors never expose secrets or internal dependency details.
10. Critical production dependencies fail closed where the security model requires them.

## Fuzzing

Current fuzz targets cover:

- opaque pagination cursor decoding and round-trip invariants;
- JWT access-token parsing;
- upload request normalization;
- WebSocket sequence parsing;
- log sanitization.

Fuzz targets must be panic-free and should reject malformed input without unbounded allocation.

## Concurrency policy

Critical repository tests should be run with at least 100 concurrent callers. The race detector is mandatory for Go code that mutates shared state. Database concurrency tests should assert the invariant, not merely that calls return without errors.

## CI gates

Minimum CI gate:

```text
gofmt check
→ go vet
→ unit/repository tests
→ race tests
→ security regression tests
→ fuzz smoke run
→ integration tests when dependencies are available
→ build API/worker/migrate
→ migration validation
→ container build/scan
```

The current repository Makefile exposes `test`, `race`, `integration`, `fuzz` and `chaos` targets.
