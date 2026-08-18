# GAPAK Front Architecture

## Layers

- `app/`: providers, router, authenticated shell and bootstrap lifecycle.
- `pages/`: route-level composition.
- `domains/*/api/`: typed resource-specific backend contracts.
- `domains/*`: domain UI and behavior.
- `shared/api/`: credentialed HTTP transport, refresh coordination, CSRF and retry policy.
- `shared/realtime/`: authenticated WebSocket transport, validation, ordering and deduplication.
- `shared/security/`: browser cryptography and URL safety.
- `shared/ux/`: accessibility, loading, error and offline primitives.

## State ownership

- Server state: TanStack Query.
- Access token and CSRF token: memory only.
- Refresh credential: backend-issued HttpOnly cookie.
- Theme preference: localStorage.
- E2EE private keys: non-extractable Web Crypto keys in IndexedDB.
- Realtime connection: one authenticated manager per application session.

Trust Rooms, Battles, Moderation, Administration, Presence and Subscriptions are server-backed. The frontend never reads the database directly: persistence, authorization, concurrency and auditing remain backend responsibilities.

The TypeScript project runs in strict mode. Production mutations go through explicit API services and must surface backend errors rather than fabricating successful state.

## Theme contract

Components consume semantic design tokens. Theme changes use View Transitions where available with a cross-fade fallback.
