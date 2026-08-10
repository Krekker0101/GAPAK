# GAPAK Backend Scalability

## Principles

- Prefer indexed PostgreSQL queries and bounded concurrency before adding infrastructure.
- Use keyset pagination for high-volume chronological feeds.
- Keep queues and WebSocket buffers bounded.
- Use Redis only where its latency/atomicity is valuable; PostgreSQL remains durable state.
- Scale API instances horizontally only after measuring DB/Redis saturation.

## Current scaling posture

- PostgreSQL access uses pgxpool with configurable max/min connections and idle/lifetime recycling.
- Chat message history already uses cursor pagination.
- Post feeds now support cursor pagination while retaining legacy page pagination.
- Worker parallelism is explicitly bounded by configuration.
- WebSocket outbound buffers are bounded.
- Post feed hydration is batched rather than one query per post.

## Capacity planning

For each deployment, size DB pool capacity against the actual PostgreSQL connection budget rather than setting a large arbitrary pool. A useful first constraint is:

`API instances × DATABASE_MAX_OPEN_CONNS <= PostgreSQL connection budget reserved for API`

Leave headroom for migrations, workers, admin tooling, and operational connections.

## Load tests

- `perf/k6/feed.js`: legacy-compatible page endpoint.
- `perf/k6/feed_cursor.js`: repeated keyset pages.

Set `BASE_URL` and `ACCESS_TOKEN` before running k6.

## Failure behavior

Performance work must not weaken correctness. Redis outages, DB timeouts, worker crashes, and WebSocket disconnects must remain within the existing hardened failure semantics.
