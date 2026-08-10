# GAPAK Release Process

## 1. Prepare

- Merge only green CI.
- Review dependency/security findings.
- Confirm migrations are backward compatible.
- Confirm release notes and operational changes.

## 2. Tag

Create an annotated semantic version tag such as `v1.4.0`.

The tag becomes the immutable application version embedded in binaries and container metadata.

## 3. CI release

The tagged pipeline performs the full verification chain, builds the image, scans it, generates an SBOM and stores release artifacts.

## 4. Database

Run the migration image as a one-shot release step. The migration command is protected by PostgreSQL advisory locking and checksum validation.

## 5. Deploy

Promote the exact image digest through staging and production. Do not rebuild between environments.

## 6. Observe

During rollout monitor:

- availability;
- p95/p99 latency;
- 5xx rate;
- DB pool saturation;
- Redis failures;
- worker queue delay;
- WebSocket errors;
- media processing failures.

## 7. Complete or rollback

Complete rollout only when the observation window remains within SLO. Otherwise roll back the immutable image and follow `ROLLBACK.md`.
