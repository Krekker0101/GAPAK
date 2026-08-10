# GAPAK Production Deployment

## Deployment contract

Production deployment is image-based and immutable:

1. CI verifies source, dependencies, tests, migrations and security.
2. CI builds a versioned container with commit/build metadata.
3. The image is scanned for CRITICAL vulnerabilities.
4. An SPDX SBOM is generated and retained with the release.
5. The image artifact is immutable and promoted by digest, not by `latest`.
6. Database migrations run as a separate release step before application rollout.
7. API and workers start only after their required dependencies are ready.

The repository intentionally does **not** hard-code a cloud provider. Kubernetes, ECS, Nomad, a VM deployment, or another orchestrator can consume the same immutable image.

## Runtime security baseline

- Run as the non-root `gapak` user.
- Drop all Linux capabilities.
- Enable `no-new-privileges`.
- Prefer a read-only root filesystem.
- Mount only explicit writable volumes/tmpfs.
- Do not mount the Docker socket.
- Do not inject `.env` files into production images.
- Supply secrets through the platform secret manager.
- Pin production images by digest.
- Expose only the application port and internal metrics endpoint.
- Put TLS termination at a trusted edge/load balancer and set `COOKIE_SECURE=true`.

## Required production configuration

At minimum, configure:

- `APP_ENV=production`
- `APP_BASE_URL=https://...`
- explicit `CORS_ORIGINS`
- `DATABASE_URL`
- `REDIS_ENABLED=true`
- `REDIS_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `PASSWORD_PEPPER`
- `ENCRYPTION_KEY_BASE64`
- `ANONYMITY_HASH_SECRET`
- `STORAGE_SIGNING_SECRET`
- storage credentials/bucket
- `COOKIE_SECURE=true`
- `METRICS_TOKEN` when metrics are enabled

Production configuration validation intentionally rejects insecure defaults and wildcard credentialed CORS.

## Rollout order

1. Validate artifact and SBOM.
2. Validate database connectivity.
3. Run migrations using the release image.
4. Verify migration idempotency/checksum integrity.
5. Start new API instances.
6. Wait for `/health/ready`.
7. Shift traffic gradually.
8. Start/roll workers with bounded concurrency.
9. Monitor SLOs and error budgets.
10. Complete rollout only after the observation window is clean.

## Graceful shutdown

API uses Fiber shutdown with a bounded context. Worker processes receive SIGINT/SIGTERM through `signal.NotifyContext`, stop accepting new work, and finish/release active jobs according to their lease/retry model. The container runtime should provide at least 30 seconds for API and 60 seconds for workers.
