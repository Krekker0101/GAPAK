# GAPAK Database Architecture

## Principles

GAPAK treats PostgreSQL as the source of truth for durable state. Redis is an acceleration/coordination layer and must not be the only authority for security-sensitive state.

### Invariants enforced by the database

- A refresh session can only be rotated by compare-and-swap against the expected refresh-token hash.
- A live friendship pair has at most one row, independent of request direction.
- A trusted-circle membership is unique per owner/member pair and cannot self-reference.
- Subscription pairs are unique and cannot self-subscribe.
- Chat membership is unique per chat/user.
- Message sequence numbers are unique per chat.
- Client message IDs are unique per chat/sender and act as durable idempotency keys.
- Audience/playback counters cannot become negative or exceed their configured maximum through normal atomic update paths.
- Processing jobs have bounded attempts and fenced leases.
- Realtime relay events have fenced relay leases.

## Transactions

Use a transaction when multiple state transitions must commit together. Prefer atomic single-statement `UPDATE ... WHERE invariant` operations for counters and compare-and-swap state changes.

`SELECT FOR UPDATE` is reserved for cases where the subsequent state transition genuinely depends on a locked row, such as password-reset token consumption and serialized message-version allocation.

## Concurrency

### Chat message ordering

`chats.last_sequence_number` is incremented in the same transaction that inserts a message. The row lock serializes sequence allocation and the unique `(chat_id, sequence_number)` constraint is the final invariant.

The row is intentionally a hot row for very active chats. This is preferred over a distributed sequence because it guarantees ordering without introducing another durable coordinator. If a future workload demonstrates contention, shard/message-bucket allocation should be benchmarked before changing the invariant.

### Idempotent message sends

`(chat_id, sender_id, client_message_id)` is a unique partial index. Retries first perform a lookup; a concurrent insert race is resolved by the unique constraint and a subsequent lookup.

### Worker leases

Processing jobs carry a UUID lease token. A worker may mark a job running/succeeded/failed only while it owns the current token. Reclaiming a stale reservation replaces the token, fencing the previous worker.

Retry scheduling is persisted in `next_attempt_at` so process restarts do not create a hot retry loop.

### Realtime relay

Realtime events use a relay lease token. A reclaimed event can no longer be acknowledged by the previous worker. Redis Pub/Sub remains at-least-once; consumers must therefore tolerate duplicate delivery using the durable event sequence.

## Pagination

Chat message retrieval already uses cursor pagination based on `(sent_at, id)`. Large social/feed endpoints still expose page/offset APIs for compatibility; indexes have been added for the current access patterns. Cursor migration should be introduced at the API contract boundary rather than silently changing existing response semantics.

## Redis

Redis operations that protect correctness use atomic primitives/scripts. Security-critical rate limiting fails closed when Redis is unavailable. Durable state transitions remain in PostgreSQL.

## Failure model

The system is designed for:

- duplicate HTTP requests;
- concurrent requests;
- process crash after DB commit;
- worker crash while holding a lease;
- Redis outage;
- stale queue notifications;
- database connection loss during a transaction.

No component claims global exactly-once delivery where the underlying transport is at-least-once. Instead, durable IDs, unique constraints, compare-and-swap updates and fencing tokens provide deterministic convergence.
