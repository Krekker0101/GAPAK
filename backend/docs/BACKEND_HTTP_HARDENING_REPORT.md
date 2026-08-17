# GAPAK Backend HTTP Hardening Report

**Date:** 2026-08-12
**Scope:** production HTTP compatibility with the existing GAPAK frontend
**WebSocket:** intentionally excluded from this change set

## 1. Executive summary

The backend was hardened only where the existing frontend's HTTP contract was objectively broken. No frontend changes, mock responses, new feature endpoints, fake identifiers, fabricated timestamps, or architectural rewrites were introduced.

The corrected blockers were:

1. E2EE pre-key bundle path parameter handling.
2. OAuth callback redirect target.
3. `/subscriptions/following` response shape and removal of placeholder profile fields.
4. Idempotency for authenticated mutations, including replay of the original successful response.
5. Readiness failure envelope correctness.

## 2. Changes

| BEFORE | AFTER | ENDPOINT | OLD CONTRACT | NEW CONTRACT | WHY CHANGE WAS REQUIRED | TEST COVERAGE |
|---|---|---|---|---|---|---|
| Handler read `?userId=` from query | Handler reads `:userId` path param | `GET /chats/pre-key-bundles/{userId}` | Frontend path-only request failed validation | UUID is taken from the route path | E2EE recipient key discovery was impossible from the current frontend | `internal/modules/chats/http_contract_test.go` + handler unit path extraction |
| OAuth callback redirected to backend `/auth/callback` | Redirects to `OAUTH_FRONTEND_REDIRECT_URL` | `GET /auth/callback/{provider}` | Current frontend router has no `/auth/callback` route | Browser returns to an existing frontend origin; AuthContext hydrates via session cookies | OAuth could finish server-side but leave the browser on a non-existent frontend route | `internal/modules/auth/oauth_contract_test.go` |
| Following response was `{items,total,page,pageSize,hasMore}` | Following response is `data: []` | `GET /subscriptions/following` | Frontend expects `SubscriptionItem[]` | Array matches current frontend API client | Runtime response-shape mismatch | `internal/modules/subscriptions/http_contract_test.go` |
| Subscription profile fields were empty strings | Profile fields are loaded from `users` | `GET /subscriptions/following` | Placeholder username/displayName/avatar/bio | Persisted backend values are returned | Empty placeholders violate source-of-truth rule | `internal/modules/subscriptions/http_contract_test.go`; repository SQL is the source |
| Idempotency only existed on auth routes and duplicate completed keys returned `409` | Authenticated mutations accept global idempotency and replay stored successful response | Mutations carrying `X-Idempotency-Key` | Frontend retries same key after transient failure; backend could create duplicates or reject the retry | Completed successful response is replayed; in-flight duplicate is `409` | Prevent unsafe duplicate mutation during frontend retries | `internal/platform/middleware/idempotency_contract_test.go`; runtime Redis integration should be added in staging |
| Readiness emitted `success:true` with HTTP 503 | Readiness emits standard error envelope | `GET /health/ready` | Non-2xx response shape conflicted with standard error handling | `success:false` + structured `503` error | HTTP contract consistency and correct failure semantics | Static contract review; full package tests pending dependency fetch |

## 3. Endpoint-level verification

### AUTH

- Route paths and methods remain unchanged for login/register/refresh/logout/password reset/2FA.
- Standard success/error envelopes remain unchanged.
- OAuth callback now lands on an actual frontend origin instead of a backend-only client route.
- Refresh authentication remains server-owned via the HttpOnly refresh cookie; CSRF is server-backed and transported only in the `X-CSRF-Token` header.

### CHAT / MESSAGES

- Existing `/chats` and message routes were not redesigned.
- E2EE pre-key bundle path handling was corrected to match the frontend's route contract.
- Existing validation and authorization remain in force.

### TRUSTED DEVICES / PRE-KEYS

- Server-generated device IDs remain authoritative.
- The pre-key bundle endpoint now consumes the real route UUID.
- No verification endpoint was added.

### NOTIFICATIONS / MEDIA / STORIES / LIVE

No HTTP route/method/DTO change was required by the audited frontend contract. Their existing envelopes and status behavior were preserved.

### CONNECTIONS

No HTTP contract correction was required after comparing the current frontend client with the backend routes.

## 4. Error and envelope hardening

No successful response is synthesized after a domain error. The idempotency layer only replays a previously persisted successful response. Failed downstream requests release their reservation.

Readiness failures now use the same structured error envelope as other non-2xx HTTP failures.

## 5. Pagination decision

No new cursor mechanism was added. `/subscriptions/following` remains array-based because the current frontend expects an array and provides no cursor/page contract for this endpoint.

## 6. Files changed

- `internal/modules/chats/controller.go`
- `internal/modules/subscriptions/controller.go`
- `internal/modules/subscriptions/repository.go`
- `internal/modules/subscriptions/service.go`
- `internal/modules/auth/controller.go`
- `internal/config/config.go`
- `internal/app/modules.go`
- `internal/app/app.go`
- `internal/app/routes.go`
- `internal/platform/middleware/idempotency.go`
- `docs/api-contract.md`
- `docs/openapi.yaml`
- `docs/BACKEND_FRONTEND_CONTRACT.md`
- `.env.example`
- `.env.production.example`
- `.env.railway.example`
- backend contract tests under `internal/**/http_contract_test.go` / `oauth_contract_test.go` / `idempotency_contract_test.go`

## 7. Verification

The relevant package test command was attempted twice, but the environment could not complete Go module downloads before the execution timeout. No passing test result is claimed on that basis.

Command attempted:

```bash
go test ./internal/modules/chats ./internal/modules/subscriptions ./internal/modules/auth ./internal/platform/middleware ./internal/platform/httpx ./internal/platform/auth ./internal/config
```

The repository was still formatted with `gofmt`, and the contract tests were added. A Redis-backed staging test is specifically recommended for validating duplicate-request replay under a real Redis instance.

## 8. Explicit non-changes

- No WebSocket protocol or authentication changes.
- No frontend changes.
- No new mock/fake endpoints.
- No fabricated IDs or timestamps.
- No cursor pagination added where the frontend expects arrays.
- No silent empty-array fallback on service errors.

## Verdict

**HTTP CONTRACT: READY FOR STAGING**

The identified HTTP blockers have been corrected. Final production promotion still requires the staging verification suite to run successfully with real PostgreSQL/Redis and browser-level OAuth/CSRF/CORS checks.
