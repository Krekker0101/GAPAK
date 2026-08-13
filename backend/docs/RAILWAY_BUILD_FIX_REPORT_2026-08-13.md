# Railway Build Fix Report — 2026-08-13

## Fixed compiler errors reported by Railway

### 1. concurrency/http.go
`WriteVersionedJSON` accepted `meta any`, while `httpx.OK` requires `map[string]any`.

Fix: normalize metadata before passing it to `httpx.OK`.

### 2. database/schema_reconciler.go
`hasShadowObjects` accepted `rowQuerier`, but the interface exposed only `Query`, while the implementation called `QueryRow`.

Fix: `rowQuerier` now explicitly includes `QueryRow(ctx, sql, args...) pgx.Row`.

### 3. websocket/service.go
`service.go` called `MessageService.ValidateSession`, but the interface did not declare it.

Fix: `ValidateSession` added to `MessageService`. Existing production adapter already implements it.

### 4. middleware/idempotency.go
Fixed all compiler errors:
- removed unused `getErr` binding;
- removed duplicate `bearerToken` declaration (shared helper from auth.go is used);
- dereferenced nullable PostgreSQL status before numeric comparison;
- dereferenced nullable status when storing replay response.

### 5. middleware/csrf.go
`auth.RefreshCookieName` did not exist.

Fix: refresh cookie is read from `SecurityConfig.RefreshCookieName`, which is the existing authoritative configuration source.

## Validation

- `gofmt`: PASS for all Go files.
- Previous Railway compiler errors are no longer present in source inspection.
- Exact Railway build command was attempted locally with `CGO_ENABLED=0 GOOS=linux GOARCH=amd64` for `api`, `worker`, `migrate`, and `admin`.
- Full build execution could not finish in this environment because Go module downloads exceeded the execution timeout. This is an environment/runtime limitation, not reported as a successful build.

## Railway build command preserved

```sh
for target in api worker migrate admin; do
  CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
  go build -trimpath -buildvcs=false -ldflags "${LDFLAGS}" \
  -o "/out/gapak-${target}" "./cmd/${target}"
done
```
