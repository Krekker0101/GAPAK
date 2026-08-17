# CSRF Server-Side Refactor — 2026-08-14

## Goal

Remove the CSRF dependency on a browser cookie. Authentication cookies remain unchanged: `gapak_at` and `gapak_rt` are still HttpOnly cookies. CSRF becomes an application-memory token on the frontend and a server-side secret on the backend.

## Final contract

1. `GET /api/v1/auth/csrf` returns `{ "csrfToken": "...", "hasSession": true|false }` in JSON.
2. Successful register/login/refresh responses also contain `csrfToken`.
3. The frontend must keep the plaintext token only in memory and send it as `X-CSRF-Token` for browser mutations.
4. No CSRF cookie is created, read, synchronized, or cleared.
5. The backend stores only a SHA-256 digest of the token.
6. Authenticated CSRF state is keyed by the signed JWT `sessionID`.
7. Before authentication, a short-lived bootstrap token is kept in a separate server-side namespace.
8. Production uses Redis for shared CSRF state across API instances. Development/tests use a mutex-protected in-memory implementation.
9. Refresh rotates the session CSRF secret and returns the new token in JSON.
10. Logout removes the current session CSRF secret.
11. Browser `Origin`/`Referer` validation remains an independent CSRF boundary; unknown origins are rejected.
12. The refresh token is never serialized into JSON and remains cookie-only.

## Security properties

- The CSRF secret is not browser-cookie state, so a forged/mutated CSRF cookie cannot satisfy validation.
- The backend never stores the plaintext CSRF token.
- Session binding prevents a token issued for one authenticated session from validating another session.
- Constant-time comparison is used for digest equality.
- CSRF state has an explicit TTL aligned to the refresh/session lifetime where applicable.
- Multi-instance production deployments use Redis, avoiding per-instance token divergence.

## Compatibility impact

The frontend must stop reading or depending on `gapak_csrf`. It should use the `csrfToken` JSON value and refresh that in-memory value after a successful token refresh or after obtaining a token from `GET /auth/csrf`.

## Verification

The refactor adds dedicated tests for session binding, bootstrap tokens, expiry, wrong-origin rejection, wrong-token rejection, acceptance without any CSRF cookie, and the invariant that auth cookie helpers never emit a CSRF cookie.

A full `go test ./...` run was attempted, but the execution environment could not finish downloading external Go modules before timeout. `gofmt` and repository-wide source checks were completed successfully.
