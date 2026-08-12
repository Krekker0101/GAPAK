# GAPAK Authentication Integration

Authentication is implemented against the authoritative backend contract in `docs/BACKEND_FRONTEND_CONTRACT.md`.

## Endpoints

- `GET /api/v1/auth/csrf`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/register-anonymous`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/oauth/:provider`
- `GET /api/v1/auth/callback/:provider` (backend redirect, not JSON)
- `POST /api/v1/auth/2fa/setup`
- `POST /api/v1/auth/2fa/verify`
- `POST /api/v1/auth/2fa/disable`

## Browser session model

- Access token: memory-only.
- Refresh token: HttpOnly `gapak_rt` cookie; never accessible to JavaScript.
- CSRF token: memory-only and sent as `X-CSRF-Token`.
- Requests use `credentials: include`.
- Refresh is single-flight.

## Login / 2FA

Login accepts `login`, `password`, and optional `totpCode`, `deviceName`, and `deviceFingerprint`.

The backend does not return a special successful `requires2FA/challengeId` response. The frontend therefore does not implement a fabricated challenge flow.

## OAuth

The frontend requests an OAuth URL from `GET /auth/oauth/:provider` and navigates to it. The backend handles `GET /auth/callback/:provider` and redirects back to the frontend. The frontend does not POST the callback code to a JSON endpoint.

## Logout

Normal logout and all-device logout both use `POST /auth/logout`; all-device logout sends `{ allDevices: true }`.

No `/logout-all` endpoint exists.
