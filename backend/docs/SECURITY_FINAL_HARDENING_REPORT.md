# GAPAK Backend — SECURITY FINAL HARDENING REPORT

Date: 2026-08-13

## Verdict

**READY FOR STAGING**

`PRODUCTION READY` is not permitted because the current environment could not complete the real PostgreSQL/Redis/Docker runtime suite or live WSS verification.

## 1. Executive Summary

This pass started from the latest Cache/Concurrency release and performed an adversarial security review across authentication, CSRF, CORS, cookies, OAuth, authorization, E2EE, WebSocket, PostgreSQL, Redis, idempotency, migrations, and configuration.

The following real defects were fixed in code.

## 2. Real Defects Fixed

### CRITICAL — stale access JWT after DB session revocation

Previously, access-token validity depended on the Redis revocation checker. If Redis was unavailable, a token could remain accepted after session logout/password reset.

Fix:
- `RequireAuthWithSessionStore` now verifies the session in PostgreSQL.
- Session must belong to the token user, be non-revoked, and not expired.
- Redis revocation remains an additional defense, not the sole authority.

### HIGH — authenticated idempotency identity collision

Previously auth idempotency was effectively scoped by network IP when JWT claims were unavailable, and the explicit auth middleware was also bypassed by the global auth-path skip.

Fix:
- One global idempotency middleware is authoritative.
- Auth routes no longer register a nested second idempotency middleware.
- Identity now prefers user/session, refresh/CSRF/device/auth-login identity.
- Request body SHA-256 is persisted and compared.
- Same idempotency key with different payload returns `409 Conflict`.

### HIGH — Redis idempotency failure could re-execute a successful mutation

If Redis write failed after a mutation committed, the previous implementation removed the Redis claim and had no durable response record.

Fix:
- PostgreSQL `http_idempotency_records` is the durable fallback.
- Successful response is persisted to DB when Redis persistence fails.
- Replay includes captured response headers and `Set-Cookie`.

### HIGH — WebSocket browser auth used session ID as trusted-device ID

The browser WebSocket middleware populated `deviceId = sessionId`, while E2EE trusted-device authorization uses an unrelated trusted-device identifier.

Fix:
- Browser WebSocket authentication stores `sessionId` separately.
- A live PostgreSQL session check is performed before the socket is accepted.
- Trusted-device validation remains an explicit E2EE operation and is not bypassed by browser WebSocket auth.

### HIGH — browser cookie mutations with missing Origin/Referer

The generic mutation CSRF middleware previously skipped validation when Origin was absent.

Fix:
- Cookie-authenticated unsafe browser mutations with neither Origin nor Referer are rejected.
- Referer is parsed and compared against exact configured origins.
- Reflected origins, `null`, subdomains, scheme changes and host-prefix tricks are rejected.
- Bearer-only server/non-browser mutations can remain origin-less.

### HIGH — intentional E2EE AES-GCM nonce reuse was not DB-enforced

Backend validation checked nonce format but did not prevent a malicious trusted device from intentionally reusing the same nonce with the same device/key.

Fix:
- Unique partial PostgreSQL index on `(sender_device_id, sender_key_id, nonce)` for active messages.

### HIGH — disabling 2FA did not require recent reauthentication

An authenticated session could disable 2FA without proof of recent 2FA authentication.

Fix:
- Successful 2FA login records `two_factor_verified_at` on the session.
- Disable-2FA now requires recent 2FA verification within 15 minutes.
- Session must remain active.

### PASSWORD RESET REPLAY

Already-existing atomic reset-token consumption was re-verified:
- row lock on reset token;
- expiry check;
- used check;
- password update and token consumption in the same DB transaction.

## 3. Auth Review

Refresh token rotation already uses compare-and-swap on the stored refresh hash.

Concurrent reuse of the previous refresh token cannot issue two independent rotations.

Logout now benefits from DB-authoritative session invalidation.

OAuth existing-account flow already rejects users with enabled 2FA instead of silently issuing a session.

OAuth state and PKCE cookies remain HTTPOnly and short-lived; callback state is required and cookies are cleared before provider completion.

## 4. CSRF / CORS / Cookies

- Constant-time double-submit token comparison retained.
- Exact configured origins retained.
- Credentialed CORS does not use wildcard origins.
- `null` origin is not accepted unless explicitly configured.
- Cookie security flags remain configuration-driven.
- Refresh cookie remains HTTPOnly.
- CSRF is no longer cookie-backed; the browser keeps the token in memory and sends it only as `X-CSRF-Token`.
- SameSite/Secure are controlled by production configuration.

## 5. Authorization

Source review re-checked object ownership paths for chat, media, stories, live and trusted-device operations.

E2EE sender device access remains transactionally checked with row locking.

## 6. E2EE

The existing GAPAK E2EE v1 protocol remains unchanged.

Additional protections:
- sender trusted-device ownership;
- trusted-device revocation race protection;
- prekey transactional consumption;
- key-envelope recipient validation;
- complete encrypted-payload equality for duplicate `clientMessageId` retry;
- nonce reuse database guard.

The backend still does not claim Signal Double Ratchet semantics.

## 7. WebSocket

Existing Origin validation and first-frame auth remain.

Browser cookie-authenticated sockets are now checked against an active server session before registration with presence/realtime state.

First-frame non-browser auth continues to require explicit token + device ID and trusted-device validation.

Existing heartbeat, message-size, queue and reconnect sequence protections are preserved.

## 8. PostgreSQL / Database Integrity

Added:

`20260813060000_http_idempotency.sql`

`20260813070000_e2ee_nonce_reuse_guard.sql`

`20260813080000_session_2fa_reauth_guard.sql`

The idempotency table uses a unique `(identity_key, method, path, idempotency_key)` constraint.

## 9. Redis Failure Handling

Idempotency now falls back to PostgreSQL when Redis cannot claim or persist a key.

Existing realtime/push workers continue to use DB-backed durable state with Redis as transport/fan-out.

## 10. Migration Safety

No migration in this security pass silently rewrites existing encrypted content or silently changes application-visible API contracts.

The new nonce unique index intentionally fails if existing production data already contains a conflicting `(device,key,nonce)` combination. That is safer than silently modifying encrypted message data.

## 11. Test / Verification Status

### PASS

- `gofmt` for all 202 Go files.
- Source/parser validation through `gofmt`.
- Existing security regression tests retained.
- New CSRF/Origin regression tests added.
- New session/2FA/idempotency database migrations added.

### BLOCKED BY ENVIRONMENT

- `go test ./...`
- `go test -race ./...`
- `go vet ./...`
- full static-analysis suite
- live PostgreSQL integration
- live Redis integration
- Docker integration environment
- real WSS handshake/reconnect

The Go dependency downloads repeatedly exceeded the execution timeout in the current environment. This is recorded as runtime unverified, not as a false green result.

## 12. Remaining Production Gates

Before production:

1. Run `go test ./...` successfully in CI.
2. Run `go test -race ./...` successfully in CI.
3. Run `go vet ./...` and chosen lint/static-analysis suite.
4. Run migrations against a real PostgreSQL staging clone containing representative legacy data.
5. Run Redis failure/recovery tests.
6. Verify two concurrent refresh requests.
7. Verify two concurrent PATCH requests with the same ETag.
8. Verify duplicate idempotent requests with Redis down.
9. Verify WebSocket browser auth after logout/session revocation.
10. Verify E2EE nonce reuse is rejected in PostgreSQL.
11. Verify 2FA disable is rejected after the recent-authentication window.
12. Verify real WSS, media object storage and push provider integration.

## 13. Final Security Assessment

The security review identified real defects and they have been addressed in source code.

The remaining uncertainty is runtime verification, not an intentionally ignored code defect.
