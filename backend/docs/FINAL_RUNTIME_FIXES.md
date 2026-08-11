# Final runtime fixes applied after Railway deployment review

## API routing

Added stable compatibility endpoints:

- `GET /`
- `GET /health`
- `GET /api/v1/health`
- `GET /health/live`

This prevents platform/browser probes from being reported as internal server errors.

## Error semantics

The generic Fiber error adapter now preserves standard HTTP statuses. Unknown routes are 404, method mismatches are 405, and request-size/rate-limit/dependency errors keep their intended status instead of being converted to 500.

## Railway port

`APP_PORT` now falls back to Railway's `PORT` environment variable when `APP_PORT` is not explicitly set.

## Worker startup

Local storage reconciliation treats a not-yet-created storage directory as an empty store. This removes a harmless startup failure on a fresh worker filesystem while keeping real storage errors visible.

## Verification limitation

The final source package was updated and formatted locally. A full `go test ./...` run could not complete in this environment because dependency downloads require network access that is unavailable to the local execution sandbox. Railway/GitHub CI remains the authoritative clean-environment verification step.
