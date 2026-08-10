# Database Operations Checklist

## Before migration

- Verify the target database is on the expected schema version.
- Check for duplicate friendship pairs before applying the unique expression index.
- Check for invalid negative counters before applying counter constraints.
- Take/verify a backup according to the deployment environment.

## Migration safety

- Migrations are protected by a PostgreSQL advisory lock.
- Each migration runs in its own transaction.
- Applied migration name and SHA-256 checksum are verified on every startup.
- Duplicate migration versions are rejected before execution.
- Never edit an already-applied migration; create a new migration instead.

## Query safety

- Run `EXPLAIN (ANALYZE, BUFFERS)` against representative production-sized datasets before adding indexes blindly.
- Monitor connection-pool saturation and query latency.
- Treat PostgreSQL constraint violations as invariant signals, not generic 500s.
- Avoid OFFSET pagination for unbounded datasets when introducing new APIs; prefer a stable cursor.

## Rollback

Schema migrations should be forward-safe. Destructive changes require a separate migration and an explicit data migration plan. Do not rely on application rollback to reverse an already-committed destructive schema change.
