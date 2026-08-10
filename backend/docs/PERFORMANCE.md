# GAPAK Backend Performance

## Scope

This document records the performance hardening performed without introducing new distributed infrastructure.

## Baseline audit

The repository contains 124 Go files and approximately 24.6k Go LOC. Static inspection found OFFSET pagination in several endpoints, while chat already had a cursor-based message path. Post hydration is batched (audience/media/comment-count/like state), so the feed path is not an obvious per-post N+1.

Runtime p50/p95/p99 measurements require a running PostgreSQL/Redis environment and a Go 1.24.13 toolchain. The audit environment has Go 1.23.2 and no network access, so no benchmark result is presented as a successful runtime measurement.

## Changes

### 1. Keyset pagination for post feeds

`GET /posts/feed` and `/posts/clips` now accept an optional opaque `cursor` and return `X-Next-Cursor` when another page exists. Existing `page` behavior remains available for compatibility.

Before: deep pages require PostgreSQL to walk and discard `OFFSET N` rows.

After: the cursor query uses `(published_at, id)` as a deterministic keyset and can use `posts_feed_cursor_idx`.

### 2. Hot-path indexes

Added partial/composite indexes for post feeds, stories feeds, recent comments, and post likes. Existing chat/subscription indexes remain intact.

### 3. HTTP compression

JSON/text responses are compressed at best-speed level to reduce payload bandwidth and network time. Media uploads/downloads remain handled by the storage pipeline.

### 4. Database pool lifecycle

Added configurable `DATABASE_MAX_CONN_IDLE_TIME` and applied it to pgxpool so idle connections can be retired without relying only on lifetime expiration.

## Performance budgets

Recommended initial production budgets; tune after real traffic measurements:

| Surface | p50 | p95 | p99 |
|---|---:|---:|---:|
| Auth/token validation | <50ms | <100ms | <200ms |
| Feed read | <150ms | <400ms | <800ms |
| Chat read | <100ms | <250ms | <500ms |
| Notification read | <100ms | <250ms | <500ms |
| Simple profile read | <75ms | <200ms | <400ms |
| Redis operation | <5ms | <15ms | <30ms |

Track DB query count/request, pool wait time, allocations/request, response bytes, active goroutines, WebSocket connections, and worker throughput alongside latency.

## Measurement protocol

1. Load a production-like dataset.
2. Run `ANALYZE` on changed tables.
3. Capture `EXPLAIN (ANALYZE, BUFFERS)` for hot queries.
4. Run the legacy OFFSET and cursor variants at shallow and deep pages.
5. Run k6 with realistic auth tokens and concurrency.
6. Record p50/p95/p99, error rate, DB pool saturation, CPU, RSS, goroutines, and Redis latency.
7. Reject an optimization if p95/p99 or memory regresses materially.

See `perf/sql/EXPLAIN_FEEDS.sql` and `perf/k6/`.
