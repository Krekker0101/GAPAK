# GAPAK Vercel ↔ Railway Integration Report

## Scope

Production preparation for the existing GAPAK Front on Vercel against the existing GAPAK backend on Railway. **The backend source was inspected but not modified in this work.**

## Actual deployment contract inspected

| Item | Actual configuration | Status |
|---|---|---|
| Frontend architecture | Vite + React | PASS |
| Vercel config | `frontend/vercel.json` | PASS |
| Railway API | `https://gapak-api-production.up.railway.app` | PASS in supplied config |
| HTTP API | `/api/v1` | PASS |
| WebSocket | `wss://gapak-api-production.up.railway.app/ws` | PASS in supplied config |
| CORS | exact Vercel origin | Backend environment requirement |
| Credentials | `credentials: include` | PASS |
| CSRF | `X-CSRF-Token` | PASS |
| Access/refresh secrets in frontend env | none | PASS |
| WebSocket token in URL | removed | PASS |
| Cookie Secure | backend must be `true` | REQUIRED |
| Cookie SameSite | backend must be `none` cross-site | REQUIRED |
| Cookie Domain | empty/host-only | REQUIRED |
| CSP | Railway API + WSS allowed | PASS |

## Important backend configuration finding

The supplied backend production example correctly expresses:

```env
COOKIE_SECURE=true
COOKIE_SAME_SITE=none
COOKIE_DOMAIN=
```

The separate `backend/docs/RAILWAY_DEPLOYMENT.md` contains an inconsistent example with `COOKIE_SAME_SITE=lax`. This frontend release does not alter the backend. **The actual Railway environment must be verified and set to `none` before staging sign-off.** The backend's production validation code explicitly rejects cross-site production cookie configuration when `SameSite` is not `none`.

## Frontend security changes

### HTTP

The existing HTTP transport uses:

- `credentials: include`
- memory-only CSRF token
- `X-CSRF-Token` on authenticated requests
- HttpOnly refresh/access cookies owned by the backend
- bounded retry behavior
- no frontend refresh-token persistence

### WebSocket

The previous frontend implementation placed `access_token` into the WebSocket URL. That is not acceptable for production because URLs can appear in browser/network/proxy telemetry. It has been removed.

The production WebSocket now calls the existing session bootstrap first and then opens the native WebSocket at:

```text
wss://gapak-api-production.up.railway.app/ws
```

Authentication relies on the backend-issued HttpOnly `gapak_at` cookie. No Socket.IO, query token, or custom client-side secret is used.

### Environment variables

Because this is Vite, use `VITE_*`, not `NEXT_PUBLIC_*`. The variables are public build-time configuration and contain only service URLs/feature flags.

## Production staging checklist

The following must be executed against a real Vercel preview/staging deployment and the real Railway service using an actual Chromium/Firefox/Safari browser. Do not mark these checks PASS from unit tests alone.

### 1. HTTPS / deployment

- [ ] Vercel deployment loads only over HTTPS.
- [ ] No mixed-content requests appear in DevTools.
- [ ] Railway API `/health` responds over HTTPS.
- [ ] `wss://.../ws` is used; no `ws://` production connection occurs.

### 2. CORS

From the deployed Vercel origin, inspect the Network response for `GET /api/v1/auth/csrf`:

- [ ] `Access-Control-Allow-Origin` equals exactly `https://gapak.vercel.app` (or the actual production custom Vercel origin).
- [ ] `Access-Control-Allow-Credentials: true`.
- [ ] No wildcard `Access-Control-Allow-Origin: *`.
- [ ] Preflight for a CSRF-protected mutation succeeds.

### 3. Cookies

After opening `/api/v1/auth/csrf` and logging in:

- [ ] `gapak_csrf` exists.
- [ ] `gapak_rt` exists after authenticated session creation.
- [ ] `gapak_at` exists after login/register/refresh.
- [ ] Auth cookies are `Secure`.
- [ ] Cross-site auth cookies are `SameSite=None`.
- [ ] Cookie Domain is empty/host-only; it is **not** the Vercel domain.
- [ ] Refresh cookie path remains backend-controlled.
- [ ] HttpOnly is set for authentication cookies.

### 4. Credentials / CSRF

- [ ] Authenticated API calls include cookies (`credentials: include`).
- [ ] Mutation requests contain `X-CSRF-Token`.
- [ ] CSRF token is not stored in localStorage/sessionStorage.
- [ ] Removing/altering the CSRF header causes the backend to reject the protected mutation.
- [ ] Failed CSRF mutations do not trigger unsafe automatic retries.

### 5. OAuth

- [ ] OAuth starts by navigating to the backend authorization URL.
- [ ] Provider redirects to the backend callback configured in Railway.
- [ ] Callback returns to the intended Vercel frontend origin.
- [ ] No OAuth client secret appears in the browser bundle or Network panel.
- [ ] OAuth cookies have correct `Secure` / `SameSite` behavior for the deployed flow.

### 6. WebSocket WSS

In DevTools → Network → WS:

- [ ] Browser connects to exactly `wss://gapak-api-production.up.railway.app/ws`.
- [ ] Query string contains **no `access_token`**.
- [ ] No Socket.IO transport (`/socket.io/`) appears.
- [ ] The handshake succeeds only when the browser session is authenticated.
- [ ] The cookie-backed authentication path is observable from the browser request.
- [ ] Reconnect does not create multiple active sockets.
- [ ] A logout closes the active socket.

### 7. Realtime correctness

- [ ] Real backend events are received and schema-validated.
- [ ] Duplicate event IDs are ignored.
- [ ] Stale sequences are ignored where the backend contract provides ordering.
- [ ] Reconnect/replay does not duplicate notifications/messages.

### 8. Media signed URLs

- [ ] Media requests use backend-issued signed URLs.
- [ ] No storage signing secret is present in frontend environment variables.
- [ ] Signed image/video/audio/document URLs load under the production CSP.
- [ ] Expired signed URLs fail closed and are refreshed through the backend flow.

### 9. CSP / security headers

Inspect the production Vercel response headers:

- [ ] `Content-Security-Policy` is present.
- [ ] `connect-src` permits only required API/WSS origins.
- [ ] `frame-ancestors 'none'`.
- [ ] `object-src 'none'`.
- [ ] `X-Content-Type-Options: nosniff`.
- [ ] `X-Frame-Options: DENY`.
- [ ] `Strict-Transport-Security` is present on the HTTPS site.

### 10. Secret scanning

- [ ] Search the generated `dist/` bundle for `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `DATABASE_URL`, `REDIS_URL`, `PASSWORD_PEPPER`, `ENCRYPTION_KEY_BASE64`, `STORAGE_SIGNING_SECRET`, and OAuth client secrets.
- [ ] Search for `access_token=` in built JS; no WebSocket query-token implementation should remain.
- [ ] Confirm no refresh token is written to Web Storage.

## Verification status

### Verified statically in this build

- Vite production configuration uses only `VITE_*` variables.
- No frontend production secret variables are required.
- HTTP uses `credentials: include`.
- CSRF header is `X-CSRF-Token`.
- WebSocket no longer appends `access_token` to the URL.
- Vercel security headers and SPA rewrite are configured.
- Production API/WSS origins match the supplied backend deployment examples.

### Not verified in this environment

A real browser deployment was **not available from the build sandbox**. DNS/network access to the supplied Vercel/Railway hostnames is unavailable here, so the following are intentionally **NOT claimed as PASS**:

- actual browser cookie acceptance;
- actual cross-site SameSite behavior;
- actual CORS response headers from Railway;
- actual OAuth provider redirect;
- actual WSS handshake;
- actual signed-media loading;
- actual deployed CSP evaluation.

These checks require the staging checklist above to be executed from a real HTTPS browser against the deployed services.

## Release decision

**Frontend production configuration: READY FOR STAGING.**

**Production release: BLOCKED until browser-level staging verification passes and Railway's live environment confirms:**

```env
COOKIE_SECURE=true
COOKIE_SAME_SITE=none
COOKIE_DOMAIN=
CORS_ORIGINS=https://gapak.vercel.app
```

No backend source changes are included in this release.
