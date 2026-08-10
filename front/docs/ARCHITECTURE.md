# GAPAK Front — Architecture

Date: 2026-08-09

## Production boundary

`src/` is the production application boundary. `src/devtools/` contains sandbox-only fixtures and legacy prototype domains. Production routes do not import devtools or legacy fixture services.

## Layers

- `app/` — providers, router, shell, bootstrap concerns.
- `pages/` — route-level composition and server-state orchestration.
- `domains/*/api/` — resource-specific HTTP contracts.
- `domains/*` — UI and domain behavior; production mutations must call an API service.
- `shared/api/` — HTTP transport, auth/session, retry, schema helpers.
- `shared/realtime/` — authenticated WebSocket transport, event parsing, deduplication, ordering and cache projection.
- `shared/security/` — browser cryptography and URL safety helpers.
- `shared/ux/` — accessibility, error/loading/offline primitives.
- `devtools/` — development-only sandbox and mocks.

## State ownership

- Server state: TanStack Query.
- Auth access token: memory only.
- Refresh/session credential: server-managed cookie; never JavaScript-readable.
- Theme: localStorage only because it is presentation state, not an authorization credential.
- E2EE private keys: IndexedDB non-extractable `CryptoKey` objects.
- Realtime connection: singleton manager scoped to the authenticated application.

## Removed prototype leakage

Trust Rooms, Battles and local Moderation fixture services were moved under `src/devtools/legacy-domains/`. They are not production domain imports. Production routes for those areas render explicit backend-contract states instead of local data.

## Known architectural limitations

1. No production login/register page is currently exposed; unauthenticated users receive an explicit authentication contract state.
2. Profile follow, Trusted Circle, mute and block mutations have no approved backend mutation contract and are intentionally not simulated.
3. Post delete/hide/mute/report are not simulated without backend endpoints.
4. Story creation has no approved `POST /api/stories` contract; the UI reports the dependency instead of claiming success.
5. Full E2EE is backend-dependent and is not claimed as Signal/Double-Ratchet.

### Theme transition contract

The light/dark theme is controlled by `ThemeContext` and CSS design tokens. Theme changes use the browser View Transitions API when available, with a cross-fade fallback for browsers that do not implement it. Components should consume semantic tokens (`bg-surface`, `text-primary`, `border-default`, etc.) rather than hard-coded light/dark colors so the transition remains coherent across the application.
