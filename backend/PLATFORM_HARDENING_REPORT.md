# Platform / CI-CD Hardening Report

## Implemented

- Added a single protected CI pipeline covering format, lint, vet, unit/integration tests, race detection, fuzz smoke tests, migration checks, dependency/security scanning, container build, CRITICAL container scanning, SBOM generation and immutable release artifacts.
- Added Go module verification and release metadata.
- Added reproducible build flags: `-trimpath`, explicit GOOS/GOARCH, `-buildvcs=false`, deterministic version/commit/build-time linker metadata.
- Added `internal/platform/version` and startup build metadata for API/worker/migrate binaries.
- Added a CI migration check that applies migrations to a clean PostgreSQL service and runs them again to verify idempotency/checksum integrity.
- Added Gitleaks and govulncheck gates.
- Added Trivy CRITICAL container vulnerability gate.
- Added SPDX SBOM generation and release image artifact retention.
- Hardened runtime Docker image: non-root user, minimal runtime, no toolchain, explicit CA certificates, only required ports.
- Hardened compose API/worker services with read-only root filesystem, tmpfs, dropped capabilities, `no-new-privileges`, healthcheck and graceful stop periods.
- Production worker now fails closed if Redis initialization fails.
- Added deployment, rollback, release and supply-chain documentation.

## Verification limits

`gofmt` and workflow YAML parsing were verified locally.

The repository requires Go 1.24.13 while the current execution environment has Go 1.23.2. With `GOTOOLCHAIN=local`, Go reports the version mismatch before compiling. Docker is not installed in this execution environment, so Docker build/container scan cannot be executed here.

These limitations are deliberately not reported as passing CI results. The GitHub Actions pipeline is configured to execute them in a real Go 1.24.13/Docker environment.
