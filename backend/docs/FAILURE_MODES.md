# GAPAK Backend — Failure Modes

| Component | Failure | Expected behavior | Recovery source |
|---|---|---|---|
| PostgreSQL | timeout | request cancelled; no blind retry of non-idempotent writes | PostgreSQL transaction state |
| PostgreSQL | connection loss after commit | client may retry safely only through idempotency semantics | durable DB state |
| Redis | unavailable | fail closed for critical security paths; durable operations remain DB-backed | PostgreSQL |
| Redis | stale cache | cache is invalidated/rebuilt; never trusted for authorization | PostgreSQL/service layer |
| Worker | crash during lease | lease expires; another worker reclaims | PostgreSQL lease state |
| Worker | duplicate delivery | job/event handler is idempotent | PostgreSQL + event IDs |
| Worker | repeated failure | exponential backoff; terminal/dead state after max attempts | PostgreSQL |
| WebSocket | disconnect before ACK | reconnect and recover by sequence | PostgreSQL |
| WebSocket | slow consumer | bounded queue; controlled disconnect | client reconnect |
| WebSocket | duplicate event | event ID deduplication | local connection state |
| Media | corrupt object | processing fails; temporary artifacts cleaned | DB + storage reconciliation |
| Media | FFmpeg timeout | process cancelled and outputs removed | DB job state |
| Media | orphan object | reconciliation discovers and removes according to retention policy | storage inventory + DB |
| Auth | refresh replay | session/family revoked; audit event emitted | PostgreSQL |
| Auth | password reset token replay | token is single-use | PostgreSQL transaction |

## Rule

If a component is not durable by design, it must be reconstructible from a durable source. Redis, in-memory WebSocket registries and worker processes are not sources of truth.
