# GAPAK Front — Phase 1 Report

**Phase:** API Layer / Contract-Driven Hardening  
**Date:** 2026-08-12  
**Status:** **IMPLEMENTED — STATIC CONTRACT GATES PASS; FULL TYPECHECK/BUILD BLOCKED BY MISSING DEPENDENCIES**

## 1. Executive summary

Phase 1 was implemented without rewriting the architecture and without changing the backend.

The API layer is now materially more contract-driven:

- normal registration preserves email and does not force anonymous mode;
- OAuth uses the documented callback endpoint;
- logout-all uses its dedicated endpoint;
- connections reject uses the documented request resource;
- fabricated connection identities were removed;
- stories no longer return successful `undefined` for view/reply;
- media list/albums no longer return fabricated empty pages;
- media completion no longer fabricates owner/privacy/kind/encryption/timestamps;
- chat mutations use the documented resource hierarchy;
- chat wire payloads are typed E2EE envelopes and no longer label themselves `SIGNAL`;
- security device operations use the documented security resource;
- live endpoints use `/api/live` and the documented playback-grant route;
- subscriptions use the documented collection endpoint;
- production API modules contain no `any`;
- a canonical contract vocabulary was added under `src/shared/api/contracts.ts`;
- realtime event types were strengthened and missing server IDs/timestamps are rejected;
- HTTP requests now have bounded deadlines plus caller cancellation;
- undocumented media part-grant fallback was removed;
- hardcoded security state was removed from the security service initial state.

## 2. Contract mismatches fixed

### Authentication

**Before**

- `register()` explicitly sent `email: undefined`.
- `register()` explicitly forced `preferAnonymous: true`.
- OAuth used `/auth/oauth/:provider` rather than the documented callback route.
- logout-all used `/auth/logout` with `{ allDevices: true }`.

**After**

- `register()` preserves the supplied email.
- Anonymous registration is isolated to `/auth/register-anonymous`.
- OAuth uses `/auth/oauth/:provider/callback` with a typed `{ code }` body.
- logout-all uses `/auth/logout-all`.

### Connections

**Before**

- list used `any[]`.
- client fabricated username, display name, email, presence, trust score and permissions.
- reject used `/api/connections/:id`.

**After**

- list consumes server-provided `ConnectionRequest` records.
- no identity fields are synthesized.
- reject uses `/api/connections/requests/:requestId/reject`.

### Stories

**Before**

- feed used `/api/stories/feed`.
- mark-viewed was a no-op.
- reply was a no-op.

**After**

- feed uses `/api/stories`.
- view uses `POST /api/stories/:storyId/view`.
- reply uses `POST /api/stories/:storyId/replies`.
- reactions have a typed allow-list.

### Media

**Before**

- list and albums always returned empty pages.
- upload used `/upload-sessions` instead of documented `/uploads`.
- cancel used `/abort` instead of `/cancel`.
- playback used `/assets/:id/playback-grants` instead of `/playback-grants`.
- completion fabricated security and metadata fields.
- an undocumented per-part grant endpoint was used as a fallback.

**After**

- list/albums are real server requests.
- upload routes match documentation.
- cancel matches documentation.
- playback grant uses the documented collection endpoint.
- completion returns `MediaAsset` from the server without fabricated values.
- multipart initialization must return all required signed part grants; missing grants are a contract error rather than a hidden fallback.

### Security

**Before**

- devices were read from `/api/chats/trusted-devices`.
- revoke/verify used chat-domain paths.
- `verifyDevice()` was a no-op.
- security state hardcoded `twoFactor.enabled = false`.
- 2FA verification returned a fabricated `{ enabled: true, backupCodesRemaining: 0 }`.
- disable returned fabricated state.

**After**

- device routes use `/api/security/devices` and documented revoke/verify actions.
- device verification is a real request.
- 2FA setup uses the server response.
- 2FA verification/disable reload server-backed state instead of fabricating success data.
- 2FA status is derived from `/api/users/me`.
- backup-code count is optional until the backend exposes it.
- undocumented alert/flag/panic-reset mutations now fail explicitly rather than returning false success.

### Chat

**Before**

- message path transformations used an incomplete route for delete/reaction.
- message payload used `any`.
- plaintext `content: ''` was fabricated.
- protocol was labeled `SIGNAL` even though the implementation is not Signal/Double Ratchet.
- device routes used the old chat trusted-device family.

**After**

- message mutations include `/chats/:chatId/messages/:messageId`.
- outbound messages are typed `E2EEMessageEnvelope` payloads.
- wire `content` remains `null`.
- `SIGNAL` is no longer emitted.
- device routes use the security resource.
- encrypted message edit remains intentionally unexposed until a real encrypted-edit contract exists.

### Notifications

Existing documented routes were retained and typed; read mutations keep idempotency keys.

### Live

**Before**

- client used `/api/live-streams`.
- playback authorization was an explicit throwing placeholder.

**After**

- list/get/chat use `/api/live` routes.
- playback grant uses `POST /api/live/:streamId/playback-grant`.

The exact live playback response remains a backend integration assumption because no backend schema was provided.

## 3. Type-system improvements

Added `src/shared/api/contracts.ts` containing canonical types for:

- authentication requests/responses;
- API errors;
- cursor pagination;
- connections/subscriptions;
- chat/message contracts;
- trusted devices;
- media contracts;
- security state/events;
- notifications;
- live responses;
- WebSocket event names and payload map.

Domain API modules were converted away from `any` to explicit DTOs.

`HttpRequestConfig` now includes `timeoutMs`.

## 4. HTTP transport improvements

`HttpClient` now provides:

- 15-second default request deadline;
- per-request timeout override;
- caller-controlled `AbortSignal` cancellation;
- distinct `TIMEOUT` error classification;
- existing bounded retry policy;
- idempotency-gated mutation retries;
- existing request IDs and normalized `ApiError`.

The transport continues to keep domain semantics outside the HTTP layer.

## 5. Realtime contract improvements

`src/shared/realtime/types.ts` now uses a typed WebSocket payload map.

`EventParser` now rejects frames without:

- server-issued event ID;
- timestamp;
- required payload.

The previous client-generated event ID fallback was removed because it could not provide reliable replay/deduplication semantics.

The `live.chat.send` outbound event is now represented in the event contract vocabulary.

## 6. Fabricated/placeholder implementations removed

The following production placeholders were removed from API implementations:

- fabricated connection users;
- story view `undefined` success;
- story reply `undefined` success;
- media list empty-page success;
- media album empty-page success;
- fabricated media ownership/privacy/kind/encryption/timestamps;
- fake 2FA state transitions;
- fake device verification;
- fake chat plaintext/encryption protocol fields;
- undocumented media part-grant fallback.

Where the backend contract is genuinely absent, the API now fails explicitly with a contract error instead of pretending the operation succeeded.

## 7. Documentation changes

Updated:

- `docs/API.md`
- `docs/API_CONTRACT.md`
- `docs/AUTH.md`
- `docs/REALTIME.md`

The documentation now distinguishes:

1. active documented contracts;
2. intentionally unexposed operations;
3. backend assumptions requiring Railway/OpenAPI confirmation.

The `/api/v1` URL normalization behavior is also explicitly documented so source-relative paths and deployed URLs are not confused.

## 8. Contract tests added

`tests/api-contract.test.ts` was expanded from the original small boundary suite to cover:

- normal registration email preservation;
- anonymous registration isolation;
- OAuth callback route;
- logout-all route;
- connections reject route;
- connection identity non-fabrication;
- chat resource paths;
- E2EE wire payload and protocol label;
- security device routes;
- story feed/view/reply routes;
- media endpoints and metadata non-fabrication;
- live endpoints;
- subscription endpoint;
- absence of `any` in production API modules;
- HTTP timeout/cancellation support;
- realtime server-issued IDs/timestamps;
- presence of canonical contract types.

## 9. Verification results

### Static tests

**PASS — 23/23 tests.**

Command:

```text
node --test --experimental-strip-types tests/*.test.ts
```

### Static lint

**PASS.**

Command:

```text
node scripts/lint.mjs
```

### Typecheck

**BLOCKED BY ENVIRONMENT — not a code failure verdict.**

`tsc --noEmit` could not resolve the repository's dependency type definitions because the uploaded project did not contain a usable installed dependency tree. The available global TypeScript installation reports missing definitions for Node/React/Babel packages.

Attempting offline `npm ci` also failed because the required package tarballs were not present in the local npm cache.

### Build

**BLOCKED BY ENVIRONMENT.**

`npm run build` fails with:

```text
vite: not found
```

The build tool is not installed in the uploaded environment.

No claim is made that the production build is green until dependencies can be installed deterministically.

## 10. Backend-dependent issues remaining

The frontend repository did not include the Railway backend or an OpenAPI/schema artifact. Therefore these items remain explicit integration gates:

### P1 / contract verification

1. Exact auth response schema, including refresh and 2FA challenge behavior.
2. Exact `/api/v1` deployment base and backend route normalization.
3. Exact connection list response shape/pagination.
4. Exact security device registration and key-field semantics.
5. Exact pre-key bundle response and device trust-state semantics.
6. Exact media upload-init response and signed-part structure.
7. Exact media playback-grant request/response.
8. Exact story feed pagination envelope.
9. Exact live playback-grant response.
10. Exact security alert/flag mutation endpoints.
11. Exact realtime event payloads and replay/ack semantics.
12. Backend enforcement of CSRF/session-cookie security.

### Intentionally not invented

The client does **not** create routes or fake response bodies for the unresolved contracts above.

## 11. Phase 1 exit criteria

| Gate | Result |
|---|---|
| API endpoint inventory reconciled | PASS against current frontend contract docs |
| Fabricated API responses removed | PASS for audited production API modules |
| `any` removed from production API layer | PASS |
| Typed request/response/error vocabulary | PASS |
| Timeout/cancellation | PASS |
| Safe retry policy | PASS / retained and tightened by contract usage |
| Registration email preservation | PASS |
| Connections reject | PASS |
| Logout-all | PASS |
| OAuth callback | PASS |
| Static contract tests | **23/23 PASS** |
| Static lint | PASS |
| Typecheck | BLOCKED — dependencies unavailable |
| Build | BLOCKED — Vite unavailable |
| Backend integration | BLOCKED — backend/OpenAPI not supplied |

## 12. Recommendation before Phase 2

Phase 1 frontend work is complete from a source/static-contract perspective, but the phase should **not be considered fully production-verified** until the repository can run:

```text
npm ci
npm run typecheck
npm run lint
npm run test
npm run build
```

against the actual Railway-compatible environment.

The next required external artifact is the backend's authoritative API schema or a reachable contract-test environment. That is necessary to turn the currently documented assumptions into verified contracts before implementing the deeper authentication, E2EE and realtime hardening work.
