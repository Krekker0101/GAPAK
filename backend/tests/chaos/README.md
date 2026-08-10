# GAPAK controlled chaos tests

These scenarios are intentionally opt-in. They must run only against an isolated
GAPAK environment with disposable Postgres, Redis and MinIO volumes.

## Preconditions

- Go 1.24.13+
- Docker Compose
- a dedicated test `.env`
- migrations applied
- no production credentials or data

## Scenarios

1. **Kill worker**: stop `gapak-worker` while a processing job is leased; restart it and assert the stale lease is reclaimed and the job completes exactly once.
2. **Redis outage**: stop Redis; assert readiness becomes unavailable when Redis is critical, API auth/rate-limit paths fail closed, and durable DB state remains intact. Restart Redis and assert recovery.
3. **DB delay**: inject latency with a test-only proxy or `tc`; assert request deadlines/cancellation, no goroutine leak, and deterministic retry behavior.
4. **Duplicate request**: send the same idempotency key concurrently 100 times; assert one durable state transition and deterministic replay/rejection semantics.
5. **Timeout after DB commit**: delay the HTTP response after commit; retry the request and assert no duplicate state transition.
6. **Crash after persistence before response**: terminate the API process immediately after durable commit using a test-only fault hook; retry and assert idempotent recovery.
7. **WebSocket disconnect after persistence**: close the socket before ACK; reconnect with `after_sequence` and assert the durable event is recovered once.
8. **Worker crash during relay**: terminate a worker after claiming an outbox event; assert lease expiry and exactly-once local delivery semantics via event ID deduplication.

## Deterministic recovery assertions

Every scenario must verify:

- no invariant is violated;
- no permanent stuck state remains;
- retry is safe;
- duplicate delivery is harmless;
- durable state is recoverable from PostgreSQL;
- Redis is treated as transport/cache rather than source of truth.
