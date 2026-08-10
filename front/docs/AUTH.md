# GAPAK Front — Authentication

## Session model

- Access token is memory-only.
- Refresh/session credential is expected in a Secure + HttpOnly cookie.
- HTTP requests use `credentials: include`.
- Refresh is single-flight to prevent concurrent refresh storms.
- A failed refresh clears the in-memory access token.
- Logout disconnects realtime, clears chat subscriptions, destroys local crypto keys and clears query state.
- Cross-tab logout uses `BroadcastChannel` and dispatches a local logout event.

## 2FA

The frontend accepts a server-issued 2FA challenge and verifies it through `POST /api/auth/2fa/verify`. It never generates or accepts a fake success response.

## OAuth

OAuth completion is a server callback contract: `POST /api/auth/oauth/:provider/callback`. No fake OAuth provider or local token exchange exists in production.

## Current production limitation

There is no production login/register page in the current route tree. `AuthGate` therefore renders an explicit authentication-required contract state instead of presenting a simulated login. A real auth screen must be connected to the existing `authApi` before the end-to-end login journey can be marked READY.

## CSRF dependency

The transport supports an in-memory `X-CSRF-Token`, but the backend contract does not yet define how the browser bootstraps/rotates that token. This remains a backend security dependency for cookie-authenticated mutations.
