# GAPAK Backend Authentication / CORS / CSRF Hardening Report

**Date:** 2026-08-12
**Scope:** HTTP authentication layer for HTTPS Vercel frontend -> HTTPS Railway backend. WebSocket authentication was hardened only as required to make browser authentication work; E2EE was not touched.

## Verdict

AUTH: **READY**
CORS: **READY**
CSRF: **READY**
COOKIES: **READY**
OAUTH: **READY**

## BEFORE / AFTER

| ENDPOINT / AREA | BEFORE | AFTER | WHY CHANGE WAS REQUIRED | TEST COVERAGE |
|---|---|---|---|---|
| `POST /api/v1/auth/register` | Refresh cookie existed; access token was not persisted as an HttpOnly cookie. | Sets HttpOnly `gapak_at` and `gapak_rt`; CSRF token is returned in JSON and stored server-side against the session. | Browser WebSocket needs a server-issued browser credential; production cookie architecture must be consistent across auth flows. | `cookies_test.go`, CSRF/store contract tests |
| `POST /api/v1/auth/register-anonymous` | Same access-cookie gap. | Same three cookie contract as register. | Same. | `cookies_test.go` |
| `POST /api/v1/auth/login` | Same access-cookie gap. | Same three cookie contract as register. | Same. | `cookies_test.go`, auth middleware tests |
| `POST /api/v1/auth/refresh` | Could accept a refresh token in request JSON and only conditionally CSRF-check based on cookie presence. | Refresh token is accepted only from HttpOnly `gapak_rt`; CSRF is always required for browser-originated unsafe refresh; rotated access/refresh cookies are issued. | Refresh tokens must never become JS-readable or be supplied by frontend JSON. | CSRF tests, DTO serialization test |
| `POST /api/v1/auth/logout` | Route required auth, but CSRF was conditionally checked only when refresh cookie existed. | Requires auth and server-side CSRF validation for browser mutation; clears only access and refresh cookies and deletes the session CSRF secret. | Logout is a state-changing browser action and must not bypass CSRF. | CSRF + cookie tests |
| `POST /api/v1/auth/2fa/*` | Authenticated mutations were not individually wrapped in CSRF middleware. | Setup/verify/disable require CSRF for browser mutations. | Unsafe authenticated mutations must be CSRF-protected. | CSRF middleware tests |
| Global browser mutations | No single global enforcement for browser-originated unsafe requests. | `BrowserMutationCSRF` enforces CSRF + exact Origin for unsafe browser requests while preserving server-to-server requests without `Origin`. | Protect all unsafe browser mutations consistently. | CSRF tests |
| CORS | Explicit origins already used, but allowed methods/preflight contract was implicit. | Explicit origins, `AllowCredentials=true`, explicit methods, explicit headers, preflight max-age; wildcard remains rejected. | Production cross-site credentialed requests require deterministic preflight behavior. | `cors_security_test.go`, config tests |
| Production cookie config | Validation already required `Secure`/`SameSite=None` for detected cross-site origins, but did not reject a Vercel domain in `COOKIE_DOMAIN`. | Production rejects non-empty `COOKIE_DOMAIN`; exact required values remain `Secure=true`, `SameSite=None`, host-only domain. | Vercel is not a cookie domain for Railway; cookies belong to backend host. | `config_auth_security_test.go` |
| OAuth callback | Success established auth cookies, but failure redirected to a backend-relative `/login`; frontend target was not strictly verified against CORS origins. | Success and failure redirects use configured frontend origin; config requires redirect origin to exactly match configured CORS and HTTPS in production. | Prevent open/unexpected redirects and ensure callback terminates in the real frontend. | OAuth contract/config tests |
| WebSocket `/ws` | Browser-compatible cookie auth was absent; query-string access token was accepted. | Browser handshake uses HttpOnly `gapak_at` plus exact Origin; query-string tokens are no longer accepted; first-frame auth remains for non-browser clients. | Browser WebSocket API cannot set arbitrary Authorization headers; query tokens leak credentials. | `websocket_auth_test.go`; service tests remain in suite |
| Authenticated HTTP | Bearer token required by middleware. | Bearer token remains supported; HttpOnly `gapak_at` is an additional server-side authentication source. | Preserve current frontend HTTP contract while making cookie auth real and consistent. | `auth_test.go` |

## Cookie contract

Production Railway configuration: `COOKIE_SECURE=true`, `COOKIE_SAME_SITE=none`, `COOKIE_DOMAIN=`.

`gapak_at`: HttpOnly access cookie, `Path=/`, expiry aligned to access token TTL.

`gapak_rt`: HttpOnly refresh cookie, `Path=/api/v1/auth`, expiry aligned to persisted refresh expiry.

CSRF is no longer cookie-backed. `/auth/csrf` and successful auth responses return a cryptographically random token in JSON. The backend stores only its SHA-256 digest, bound to the authenticated session ID (or a short-lived bootstrap slot before login), and the frontend keeps the plaintext token in memory and sends it as `X-CSRF-Token`.

Logout clears all auth cookies with the same path/domain/SameSite/Secure attributes used for issuance.

## CSRF contract

`GET`, `HEAD`, and `OPTIONS` are safe and are not blocked by CSRF middleware.

Unsafe browser mutations require `X-CSRF-Token`. The header token is validated against the server-side CSRF store, using constant-time digest comparison. A matching configured `Origin`/`Referer` remains required for browser-originated mutations; unknown browser origins are rejected. No CSRF cookie exists.


## Server-side CSRF implementation

CSRF secrets are generated with 32 cryptographically random bytes. The browser receives the plaintext token only in JSON and is expected to keep it in application memory. The backend stores only a SHA-256 digest. For authenticated sessions the digest is keyed by the signed JWT session ID; before authentication, a short-lived bootstrap token is stored separately.

Production uses the existing Redis dependency for shared CSRF state across API instances. Development and tests use a mutex-protected in-memory store. Session refresh rotates the stored CSRF secret. Logout removes the current session secret. No CSRF secret is stored in any cookie or JWT claim.

## CORS contract

Production does not allow `*`. `Allow-Credentials` is enabled. `CORS_ORIGINS` must contain explicit origins and must be configured to the actual Vercel origin. Allowed headers include `Authorization`, `X-CSRF-Token`, `X-Idempotency-Key`, and `X-Request-Id`. OPTIONS preflight is explicitly supported.

## OAuth contract

OAuth state and PKCE verifier remain HttpOnly cookies. The callback consumes them, validates state, clears them, creates the normal session, sets auth cookies, and redirects only to `OAUTH_FRONTEND_REDIRECT_URL`. Production requires that redirect URL to use HTTPS and exactly match a configured CORS origin. Provider authorization callbacks remain GET because that is the OAuth provider contract.

## WebSocket authentication contract

The browser path is cookie-first. `/ws` checks the `Origin` against configured origins and validates `gapak_at` before the websocket service handles the connection. The backend no longer accepts `access_token` as a query parameter. Clients without cookies may use the existing first-frame `auth` message with a valid access token.

## Verification

Added tests cover: unauthorized access, expired access-cookie rejection, HttpOnly/Secure/SameSite attributes, host-only cookies, logout clearing, CSRF wrong-origin rejection, CSRF matching-origin success, production cookie validation, OAuth redirect validation, exact credentialed CORS, preflight headers, and prohibition of refresh-token JSON serialization.

The Go test command was attempted twice against the hardened repository but could not complete because the environment timed out while downloading external Go modules. No successful full test-suite result is claimed. `gofmt` and static source inspections were completed successfully.
