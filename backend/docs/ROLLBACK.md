# GAPAK Rollback Strategy

## Application rollback

Application images are immutable. Roll back by redeploying the previous known-good image digest.

Do not rebuild an old commit during an incident.

## Database rollback

Database migrations are forward-only by default.

If a release introduces a schema incompatibility:

1. Stop the rollout.
2. Keep the compatible schema in place.
3. Roll application binaries back to the previous image if safe.
4. If the migration is additive, leave it in place.
5. If data transformation occurred, use a reviewed compensating migration.
6. Never manually delete rows/columns during an incident without an approved recovery procedure.

Prefer expand/contract migrations:

`expand schema → deploy compatible code → backfill → switch reads/writes → contract later`.

## Rollback triggers

- sustained 5xx above SLO budget;
- p95/p99 latency regression;
- authentication failures;
- queue backlog growth;
- realtime delivery failures;
- media processing failures;
- database saturation;
- security regression.

## Recovery validation

After rollback verify:

- `/health/ready`;
- authentication;
- database writes;
- Redis connectivity;
- worker queue processing;
- WebSocket reconnect;
- media playback;
- error rate and latency.
