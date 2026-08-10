# Distributed Concurrency and Invariants

## State-transition matrix

| Domain | Invariant | Enforcement | Duplicate/retry behavior |
|---|---|---|---|
| Refresh session | old refresh hash rotates once | SQL CAS | replay rejected/fenced |
| Chat message | one client ID per chat/sender | unique index + retry lookup | returns existing message |
| Chat sequence | unique monotonic sequence per chat | row update + unique constraint | failed transaction rolls back allocation |
| Friendship | one live pair regardless of direction | expression unique partial index | conflict |
| Trusted membership | one owner/member row | unique index | idempotent insert |
| Likes | one user/post | unique constraint | conflict/idempotent service behavior |
| Story/post audience views | never exceed max | conditional atomic increment | exhausted view rejected |
| Playback grant | never exceed max | locked grant + conditional state transition | consumed/expired rejected |
| Worker job | one active owner | lease token + status | stale owner fenced |
| Realtime relay | one current relay lease | relay token | stale owner cannot acknowledge |

## Failure scenarios

### Timeout after successful commit

The client retries. Durable idempotency keys or unique constraints identify the existing operation. The server returns the already-created resource rather than performing the mutation twice.

### Process crash during worker execution

The lease eventually becomes stale. Another worker can reclaim it with a new token. The old worker cannot mark the job complete after reclamation.

### Redis outage

Durable database state continues to function. Security-sensitive rate limits fail closed. Queue/realtime components fall back to PostgreSQL polling where supported.

### Concurrent audience views

A conditional `UPDATE` checks the current counter and increments atomically. Two concurrent viewers cannot both consume the final permitted view.

### Concurrent friendship creation

The database expression unique index canonicalizes the unordered pair with `LEAST/GREATEST`, so both request directions converge on one live row.

## Locking guidance

Avoid broad `FOR UPDATE` scans. Lock only the row whose invariant is being transitioned. Prefer an atomic `UPDATE ... WHERE` when the new state can be expressed from the current row.

## Retry guidance

Retries must be bounded and persisted. Worker backoff is exponential and capped. Application-level retries must always preserve idempotency and context cancellation.
