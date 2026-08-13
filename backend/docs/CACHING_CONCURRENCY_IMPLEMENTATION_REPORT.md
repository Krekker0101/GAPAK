# GAPAK HTTP Cache + Optimistic Concurrency Implementation Report

## Implemented

- `entity_versions` durable revision table.
- HMAC-signed strong opaque ETags.
- `If-None-Match` + `304 Not Modified` for versioned entity GETs.
- `If-Match` + atomic PostgreSQL row-lock precondition checks.
- `412 concurrency.version_conflict` with current version and ETag when the request carries a valid If-Match token.
- Private authenticated cache semantics: `Cache-Control: private, no-cache, must-revalidate` and `Vary: Authorization, Cookie`.
- `no-store` on mutation responses.
- Soft-delete tombstone revisions preserved; hard-deleted subscriptions retain a version row.
- Existing clients without `If-Match` remain backward compatible.
- E2EE message concurrency remains on its existing sequence protocol.

## Versioned resources

- user profile (`/users/me`, `/users/:userId`)
- connections (mutation preconditions on connection entity)
- subscriptions (mutation preconditions on subscription entity)
- stories
- live streams
- media files

## Atomicity

The authoritative revision row is locked with `SELECT ... FOR UPDATE` in the same transaction as the mutation. Two concurrent mutations carrying the same ETag therefore serialize; the first successful mutation advances the revision and the second receives `412`.

## Migration

`db/migrations/20260813040000_entity_versions_etag.sql`

The migration is idempotent, initializes existing rows with revision 1, and installs triggers for inserts/updates/deletes. Soft-delete tombstones remain available for stale-write detection.

## Verification

- `gofmt`: PASS across repository.
- ETag/If-Match parser tests added.
- Migration idempotency/static checks added.
- Full selected-package `go test` attempted; dependency download did not complete within the environment timeout. No test assertion failure was observed.
- Real PostgreSQL concurrency/304 runtime verification remains pending a reachable integration database.
