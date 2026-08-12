# GAPAK Front — Phase 4 Report

**Phase:** Business domains production completion  
**Date:** 2026-08-12  
**Scope:** Media, Stories, Feed, Connections, Profiles, Notifications  
**Status:** **SOURCE-LEVEL HARDENING COMPLETE; BACKEND CONTRACT VERIFICATION REQUIRED**

## 1. Executive summary

Phase 4 removed the remaining user-facing fake-success paths that were visible in the targeted business domains and connected the UI to real server-owned state wherever a contract existed.

The main principle was preserved throughout the work:

> The frontend never invents server state. When the backend contract is unavailable, the client uses an isolated, explicitly documented adapter and does not claim success.

The project now has:

- real media listing/pagination/albums;
- real signed single-part and multipart upload paths;
- bounded-memory incremental SHA-256 hashing;
- per-part retry and explicit failure states;
- upload expiration checks and server-state recovery checks;
- server-authoritative media metadata;
- real story create/view/reaction/reply/delete API boundaries;
- real story composer using a server-issued media ID instead of a fabricated URL;
- profile-scoped post loading instead of `posts={[]}`;
- real profile like/comment mutations;
- real block/unblock adapters;
- corrected connection removal to use the target user's ID;
- connection request cancellation adapter;
- feed deduplication across cursor pages;
- typed optimistic like rollback and user-visible mutation errors;
- notification cursor pagination;
- notification realtime reconciliation and duplicate-ID suppression;
- explicit E2E coverage for the targeted business-domain routes.

No production business implementation was replaced with a mock or fake response.

---

# 2. MEDIA

## Completed

### Media library

`MediaVaultPage` now consumes the server `GET /api/media` contract through an infinite cursor query.

Implemented:

- cursor pagination;
- search;
- media kind filtering;
- privacy filtering;
- album filtering;
- sort selection;
- server-backed empty/error/loading states.

The client does not synthesize media records.

### Albums

`GET /api/media/albums` is consumed through a dedicated typed query.

### Upload initialization

Upload initialization is server-owned and sends:

- file name;
- MIME type;
- size;
- SHA-256 checksum;
- usage context;
- privacy;
- album.

### Single-part upload

A real signed single-upload path was added. The previous multipart-only assumption no longer breaks a valid single-part session.

### Multipart upload

Multipart uploads now:

- validate every required signed part grant;
- upload bounded `Blob` slices;
- use three concurrent workers;
- retry transient part failures up to three attempts;
- preserve completed part ETags;
- report progress from completed and in-flight bytes;
- fail explicitly when a required grant is missing.

### Completion

Completion uses the server's canonical `MediaAsset` response. The frontend no longer constructs owner, encryption, privacy, timestamps or media kind values.

### Cancellation

Cancellation now waits for the backend cancellation request when a server upload session exists.

A failed cancellation is surfaced as a failed upload state instead of being silently swallowed.

### Expiration

The upload manager validates session expiry before transfer and checks the upload session again before completion. An expired session is surfaced as a recoverable failure instead of being treated as a successful upload.

### Playback/download

Playback continues to use server-issued playback grants.

Media assets may additionally contain a server-issued short-lived `downloadUrl`. The frontend never constructs CDN/download URLs.

### Large-file memory behavior

The previous full-file:

`file.arrayBuffer()`

checksum path was removed.

A bounded 4 MiB incremental SHA-256 implementation based on the standardized SHA-256 algorithm is now used. The complete media file is never materialized as one ArrayBuffer merely to calculate its checksum.

Deterministic SHA-256 vectors are covered by tests.

---

# 3. STORIES

Implemented real API boundaries for:

- list;
- get;
- view;
- reaction;
- reply;
- create;
- delete.

The composer now uploads media using the `STORY` media context and sends the server-issued `mediaId` to the story API.

It does **not** send a fabricated public media URL as the source of truth.

Story publication only shows success after the backend returns successfully.

Story deletion only closes the viewer after the backend deletion succeeds.

The previous no-op behavior and success-without-request behavior were removed.

Viewer analytics no longer claim that viewer data was updated when no viewer records exist.

### Backend dependency

The exact deployed backend contract for:

- `POST /api/stories`;
- `DELETE /api/stories/:storyId`

still needs confirmation because the original backend schema supplied with the frontend did not define these operations.

These routes are explicitly marked **backend contract required** in `docs/API.md`.

---

# 4. FEED

Implemented/verified:

- infinite cursor pagination;
- IntersectionObserver-based loading;
- refresh/error recovery;
- optimistic like;
- rollback after failed like;
- idempotent like mutation;
- comment creation;
- mutation error feedback;
- post creation error feedback;
- duplicate post elimination across pages;
- server-backed story preview data;
- real story reaction flow;
- real story creation entrypoint.

The previous `storyGroups = []` placeholder has been removed from the feed page.

Story groups now originate from `storiesApi.feed`.

The previous story callbacks that resolved to `undefined` have been removed from the feed page.

---

# 5. CONNECTIONS

Verified and hardened:

- list;
- request;
- accept;
- reject;
- remove.

A request cancellation adapter was added:

`DELETE /api/connections/requests/:requestId`

The connection removal UI was corrected to send the **target user ID**, not the connection-request ID.

This was a real behavioral bug: the API contract is `/connections/:userId`, while the previous UI passed `req.id`.

### Backend dependency

The exact cancellation endpoint was not present in the original authoritative API inventory, so it is explicitly documented as **backend contract required** rather than represented as a fake local mutation.

Block/unblock are exposed through isolated user relationship adapters:

- `POST /api/users/:userId/block`
- `DELETE /api/users/:userId/block`

The profile UI only updates its server state after those requests succeed.

---

# 6. PROFILES

The previous production placeholder:

`posts={[]}`

has been removed.

Profiles now request:

`GET /api/users/:id-or-username/posts`

through a dedicated `usersApi.posts` adapter with cursor pagination.

The profile page also now uses real server mutations for:

- post like/unlike;
- comment creation;
- block/unblock;
- connection request/remove.

No fake profile users are generated.

### Backend dependency

The profile-post route was not part of the original backend API inventory. It is therefore isolated and explicitly marked **backend contract required** in `docs/API.md`.

If the Railway backend uses a different canonical profile-post route, only this adapter should change; the profile UI does not need to be rewritten.

---

# 7. NOTIFICATIONS

The shell notification popover now supports:

- cursor pagination;
- load-more behavior;
- unread count;
- mark read;
- mark all read;
- realtime reconciliation;
- duplicate ID suppression across pages;
- cross-tab read propagation through the existing realtime manager;
- visible loading/error/empty states.

`notification.new` realtime events trigger notification and unread-count reconciliation.

The UI does not create notification objects locally.

---

# 8. Tests added

New file:

`tests/phase4-business-domains.test.ts`

Coverage includes:

1. large-file hashing is incremental;
2. SHA-256 empty vector;
3. SHA-256 `abc` vector;
4. story create/view/reply/delete contract presence;
5. profile post adapter and absence of empty production post implementation;
6. connection remove/cancel contract;
7. notification pagination/realtime reconciliation;
8. fake-success callback detection.

New browser suite:

`e2e/phase4-business-domains.spec.ts`

Coverage targets:

- Media Vault;
- Stories;
- Profile;
- Connections;
- Notifications.

The browser suite requires a real backend environment through `GAPAK_E2E_AUTH_URL`.

---

# 9. Verification results

## Static tests

**38 / 38 PASS**

This includes all previous Phase 1 and Phase 3 contract/security tests plus the new Phase 4 suite.

## Static lint

**PASS**

`npm run lint`

## TypeScript

**BLOCKED BY ENVIRONMENT / DEPENDENCIES**

`npm run typecheck` cannot be treated as a production pass because the uploaded project environment does not contain installed dependencies.

Observed missing packages include:

- React;
- React Router;
- TanStack Query;
- Motion;
- Lucide;
- HLS.js;
- Playwright;
- Node type declarations;
- Vite;
- Tailwind Vite integration.

After filtering the TypeScript output, no additional Phase 4-specific semantic error remained in the changed media/story/profile/feed/connection source beyond the missing dependency environment and an existing VideoPlayer type issue that was corrected during this phase.

A fresh dependency installation must be followed by a full typecheck before release.

## Build

**BLOCKED**

`npm run build` currently fails because `vite` is not installed in the supplied environment.

## Browser E2E

**BLOCKED**

`npm run test:e2e` cannot execute because the supplied environment does not contain the repository's Playwright dependency/runtime.

The new E2E suite is therefore present but not claimed as passing.

---

# 10. Remaining backend requirements

These are intentionally not faked:

### Stories

- confirm `POST /api/stories` request/response envelope;
- confirm `DELETE /api/stories/:storyId`;
- confirm story media authorization/expiration behavior.

### Profiles

- confirm canonical profile-post route and pagination envelope.

### Connections

- confirm request cancellation endpoint;
- confirm block/unblock endpoints and authorization semantics.

### Media

- confirm exact `MediaAsset.status` and `checksumSha256` response fields;
- confirm short-lived `downloadUrl` semantics;
- confirm whether upload-session GET reissues signed grants after expiration;
- confirm single-part completion request shape;
- confirm multipart ETag semantics.

### Notifications

- confirm realtime notification payload contains the same notification identity fields as REST;
- confirm unread count semantics after a realtime event;
- confirm server cursor invalidation behavior after mark-all-read.

---

# 11. Production gate

Phase 4 source-level gate:

**PASS**

Static lint and all 38 static tests pass.

Phase 4 backend integration gate:

**PENDING**

Phase 4 full release gate:

**NOT YET PASS**

The remaining blocker is environmental/backend integration, not a reason to introduce mock behavior.

Required final verification sequence:

1. install dependencies with `npm ci`;
2. run `npm run typecheck`;
3. run `npm run lint`;
4. run `npm run test:static`;
5. run `npm run build`;
6. configure a real Railway backend test environment;
7. run `npm run test:e2e` with `GAPAK_E2E_AUTH_URL`;
8. verify all backend-contract-required endpoints against the deployed backend;
9. run large-file upload tests with 250 MB+ media;
10. verify expiration/recovery and playback grants against real signed URLs.

## Conclusion

Phase 4 removed the known fake/no-op business behavior in the targeted domains without replacing missing backend functionality with fabricated implementations.

The architecture remains intact. The business domains now have real server-facing boundaries and explicit failure behavior. Remaining work is contract confirmation and real backend/browser verification, especially for the endpoints that were not defined by the supplied backend contract.
