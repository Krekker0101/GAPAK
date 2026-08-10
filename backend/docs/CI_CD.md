# GAPAK CI/CD

## Required pipeline

`FORMAT → LINT → VET → TEST → RACE → SECURITY → DEPENDENCY → BUILD → MIGRATION CHECK → CONTAINER BUILD → CONTAINER SCAN → SBOM → ARTIFACT → RELEASE`

### Gates

A pull request cannot pass the verification/security stages when:

- formatting is incorrect;
- lint fails;
- `go vet` fails;
- tests fail;
- race tests fail;
- fuzz smoke tests fail;
- migration validation fails;
- Go vulnerability scan reports a reachable vulnerability;
- Gitleaks finds a secret;
- container scanning finds a CRITICAL vulnerability;
- Docker build fails.

## Build reproducibility

Release binaries are built with:

- pinned Go version from `go.mod`/CI;
- `-trimpath`;
- `-buildvcs=false`;
- deterministic linker metadata supplied by CI;
- explicit `GOOS`/`GOARCH`;
- immutable source commit metadata.

The container build receives `VERSION`, `COMMIT` and `BUILD_TIME` as explicit build arguments.

## Supply chain

CI verifies `go.sum`, runs `go mod verify`, runs `govulncheck`, scans the source tree for secrets, scans the final container and produces an SPDX SBOM.

For production, GitHub Actions and third-party actions should be pinned to reviewed commit SHAs in the organization's hardened runner policy.

## Artifacts

A tagged release produces:

- immutable versioned container image;
- compressed image artifact;
- SPDX SBOM;
- GitHub release metadata.

Promote artifacts by digest. Never deploy `latest`.
