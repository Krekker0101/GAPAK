# GAPAK Front — Production Readiness

Updated: 2026-08-18

## Repository status

| Area | Status | Evidence |
|---|---|---|
| Architecture | READY | Routed domains use typed API services and server-owned identifiers/state. Runtime fixtures and template domain screens are absent. |
| Authentication | READY | HttpOnly refresh-cookie restoration, memory-only access/CSRF material, single-flight refresh and explicit logout are implemented. |
| Security | READY | CSP/security headers, fail-closed transport/E2EE validation, backend sessions/devices/2FA/audit/panic controls and regression tests are present. |
| Business domains | READY | Feed, profiles, connections, stories, media, chats, live, trust rooms, battles, presence, moderation, subscriptions and administration use backend routes. |
| Realtime and sync | READY | Authenticated WebSocket recovery and `/sync` cursor recovery invalidate server-backed caches without fabricating events. |
| Push | READY | Service worker subscription, backend device registration/list/revocation and browser unsubscribe are implemented. |
| Quality gates | READY | Strict TypeScript, static lint, contract/security/unit/integration tests, production build and performance budget pass locally. |

## Deployment requirements

Repository checks cannot prove external deployment state. Release verification still requires a real HTTPS environment with:

- the production API, database, storage, Redis and WebSocket services available;
- exact credentialed CORS and cookie settings described in `docs/DEPLOYMENT.md`;
- valid OAuth provider configuration and redirect URLs;
- matching public/private VAPID configuration for Web Push;
- browser checks for refresh-cookie restoration, CSP, WSS, signed media URLs and notification permission.

Encrypted attachment sending and client-driven device-key rotation are not exposed in the UI because the backend does not publish the required key-wrapping/rotation contracts. Existing encrypted text messaging fails closed instead of simulating either capability.
