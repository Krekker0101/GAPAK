# GAPAK Front — Testing

## Available checks

- `npm run typecheck` — TypeScript compiler check.
- `npm run lint` — production static security/architecture lint.
- `npm run test:static` — Node built-in tests for API boundaries, transport credentials, WebSocket URL safety and production mock isolation.
- `npm run test` — typecheck + lint + static tests.
- `npm run test:e2e` — Playwright critical-path suite when a real backend/auth test environment is configured.

## Critical domains

AUTH, FEED, PROFILE, CONNECTIONS, CHAT, NOTIFICATIONS, MENTIONS, MEDIA, STORIES, LIVE, SECURITY, PANIC MODE and ROUTING are covered at the production-contract level. Full browser coverage is still backend-dependent.

## E2E blocker

The current production route tree has no login/register UI. Therefore the full requested `Register/Login → Feed → Profile → Connection → Chat → Message → Notification → Media → Logout` path cannot truthfully pass today. The Playwright test is explicitly skipped unless `GAPAK_E2E_AUTH_URL` points to a real authenticated test environment.

No fake backend or fake login is introduced just to make E2E green.

## Manual QA matrix

Run with a real backend at 390, 430, 1024, 1280 and 1440px widths, in light and dark themes, online/offline, keyboard-only and reduced-motion modes.
