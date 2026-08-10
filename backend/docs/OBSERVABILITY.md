# GAPAK Observability

## Signals

GAPAK emits structured JSON logs and Prometheus-compatible metrics from the API and worker processes.

### Logging

Every HTTP request carries:
- `request_id`: Fiber request identifier;
- `trace_id`: per-request trace identifier;
- `correlation_id`: caller supplied `X-Correlation-ID` when valid, otherwise request ID;
- `component` and `operation`;
- HTTP status and latency;
- authenticated `user_id` and `session_id` when available.

The logger never intentionally records credentials, tokens, encryption keys or raw PII. Error strings are sanitized before being attached to centralized HTTP error logs.

### Metrics

`GET /metrics` exposes bounded-cardinality metrics including:
- HTTP requests/errors/latency;
- rate-limit events;
- PostgreSQL query latency/errors and pool state;
- Redis command latency/errors;
- worker outcomes, duration and queue depth;
- WebSocket connections, active connections, messages, errors and slow consumers;
- media lifecycle events and processing latency;
- authentication security events.

Worker metrics are exposed on `WORKER_METRICS_PORT` (default `9091`) and are intended for an internal monitoring network.

### Tracing

The current implementation uses lightweight W3C-style correlation primitives (`trace_id` + `correlation_id`) without forcing a heavyweight tracing dependency into the hot path. PostgreSQL query timing inherits the request context. A future OpenTelemetry exporter can attach to these contexts without changing API contracts.

## Health

- `/health/live` is process liveness only.
- `/health/ready` checks PostgreSQL and Redis according to configured criticality and reports a bounded PostgreSQL pool snapshot.
- Startup diagnostics log only non-sensitive application/environment metadata.

## Cardinality policy

Never use raw URLs, user IDs, chat IDs, tokens, email addresses, SQL text or arbitrary exception strings as metric labels. Endpoint labels use registered Fiber route templates.

## Alerting guidance

Page on sustained SLO violations, dependency unavailability, database pool exhaustion, Redis error spikes, worker backlog growth, WebSocket slow-consumer spikes and authentication anomaly spikes.
