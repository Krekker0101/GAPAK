# GAPAK Backend — Chaos Engineering

Chaos testing is controlled, isolated and hypothesis-driven. Never run destructive scenarios against production data.

## Hypotheses

### Worker crash
**Hypothesis:** a worker crash cannot corrupt durable job state. A stale lease is eventually reclaimed and only the current lease holder can complete the job.

### Redis outage
**Hypothesis:** loss of Redis cannot erase durable state. Security-sensitive Redis-dependent paths fail closed where configured; DB-backed recovery continues after Redis returns.

### Database delay
**Hypothesis:** request contexts propagate deadlines/cancellation and bounded pools prevent an unbounded goroutine or connection buildup.

### Duplicate request
**Hypothesis:** concurrent retries with the same idempotency identity cause at most one durable transition.

### Commit-before-response timeout
**Hypothesis:** if a client times out after the DB commit, retrying is safe and returns/reuses the existing durable state.

### Crash after persistence
**Hypothesis:** a process crash after persistence but before the HTTP ACK cannot create a second durable object when the operation is idempotent.

### WebSocket disconnect
**Hypothesis:** a client that disconnects after persistence but before ACK can reconnect and recover the missing event from durable sequence state.

### Relay worker crash
**Hypothesis:** outbox events are leased/fenced and duplicate Redis delivery is harmless because consumers deduplicate by event ID.

## Exit criteria

Every scenario must produce:

- no invariant violation;
- bounded resource usage;
- deterministic retry behavior;
- recoverable durable state;
- no duplicate externally-visible state transition;
- observable failure and recovery metrics/logs.

See `tests/chaos/README.md` for the execution matrix.
