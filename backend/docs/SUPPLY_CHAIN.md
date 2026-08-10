# GAPAK Supply Chain Security

## Source

- `.env` is excluded from build context.
- Secrets must never be committed.
- `go.sum` is verified in CI.
- Dependency vulnerability scanning runs on every protected branch.

## Build

- Go toolchain version is explicit.
- Builds use `-trimpath`.
- Release metadata is explicit and auditable.
- Runtime image runs as non-root.

## Container

- Minimal Alpine runtime.
- No compiler/toolchain in runtime layer.
- FFmpeg is installed only because the worker requires it.
- Container scanner blocks CRITICAL vulnerabilities.
- SPDX SBOM is retained with the release.

## Promotion

Promote by immutable digest. Environment-specific configuration and secrets are supplied at runtime, never baked into the image.
