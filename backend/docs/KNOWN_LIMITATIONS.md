# GAPAK Backend — Known Limitations

## Verification limitations

- No Go 1.24.13 toolchain was available in the audit runtime.
- Dependency downloads did not complete before timeout.
- Docker, PostgreSQL and Redis were unavailable.
- No production-like dataset was available for p95/p99 or query-plan measurement.

## Implementation limitations

### Media object storage

The current adaptive video worker is fail-closed for non-local object storage. It must not mark HLS media READY without actually generating the derived assets. A production deployment using S3-compatible storage must either provide the object-store processing path or deliberately use a deployment topology that processes media locally and publishes the resulting objects.

### HLS gateway

The protected gateway rewrites playlist references into signed URLs. This preserves the current API shape but creates database work proportional to playlist references. Benchmark this path with realistic long VOD playlists before very high-scale rollout.

### Idempotency

The current generic idempotency middleware reserves a key atomically and prevents concurrent duplicate execution, but it does not yet persist/replay the original HTTP response. Product-critical mutations that require exact retry semantics should use a durable operation record with response replay.

### OAuth + 2FA

OAuth is deliberately prevented from bypassing local 2FA. A future UX may add an explicit server-side OAuth-to-2FA challenge flow, but this audit does not introduce that product feature.

### Deployment

The repository intentionally does not prescribe Kubernetes, a specific cloud provider or a service mesh. Those choices must be validated against the actual production environment.
