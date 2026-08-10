# GAPAK Incident Response

## Severity

### SEV-1
User data/security incident, total outage, widespread authentication failure, or sustained data loss risk.

### SEV-2
Major feature unavailable, severe latency, queue backlog or realtime degradation affecting a significant portion of users.

### SEV-3
Localized degradation with workaround and no evidence of data loss.

## First 10 minutes

1. Declare incident and assign Incident Commander.
2. Record start time and affected services.
3. Check `/health/ready`, HTTP error rate, p95/p99, DB pool, Redis errors, worker queue depth and WebSocket disconnects.
4. Compare current metrics to the last known-good deployment.
5. Freeze unrelated deploys.
6. Preserve security/audit logs before making destructive changes.

## Database incident

Check pool saturation, query latency and lock contention. Prefer reducing load or disabling a non-critical workload over restarting PostgreSQL blindly.

## Redis incident

Determine whether Redis is a cache/transport dependency or critical state dependency for the affected path. Preserve PostgreSQL as source of truth for durable state. Avoid mass cache deletion without an owner and rollback plan.

## Realtime incident

Check Redis fanout, active connections, slow consumers and durable outbox lag. Clients should recover from PostgreSQL after reconnect; never use Redis as the authoritative message store.

## Security incident

Revoke affected sessions/tokens, preserve evidence, rotate exposed secrets, identify blast radius, and document all containment actions. Do not paste secrets or raw PII into incident channels.

## Recovery

1. Confirm dependency health.
2. Drain backlog gradually.
3. Verify error rates and latency return to SLO.
4. Re-enable paused workloads.
5. Run reconciliation jobs for media/realtime state if applicable.
6. Publish a timeline and root-cause analysis with corrective actions.
