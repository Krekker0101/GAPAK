# Backend Contract Phase Report

## Scope

This phase compared the current frontend API layer with the supplied GAPAK Go/Fiber backend. Backend code was treated as authoritative. No backend code was changed.

## Frontend changes

- Added `src/shared/api/backendContracts.ts` containing strict request/response/error/domain DTOs based on backend Go DTOs.
- Updated shared API envelope/error types to match the actual `{success,data,meta}` and `{success:false,error,meta}` envelopes.
- Canonicalized auth API calls to the actual routes.
- Normal registration now explicitly sends `preferAnonymous: false` unless explicitly requested.
- Added actual TOTP fields to login and exact 2FA setup/verify contracts.
- Replaced fake `/auth/logout-all` with `POST /auth/logout {allDevices:true}`.
- Corrected OAuth POST endpoint and documented GET callback redirect semantics.
- Corrected connection request body to `targetUserId` and accept/remove/trusted-circle paths.
- Removed live `/api/live` assumptions in favor of `/live-streams`.
- Corrected story feed/get/reaction/highlight/delete paths and removed the nonexistent POST view/reply contract.
- Corrected media upload-session paths, abort path, completion shape, per-part grant endpoint and playback-grant path.
- Added support for requesting missing signed upload-part grants after session creation.
- Corrected chat trusted-device endpoints from nonexistent security-device routes.
- Corrected notification pagination to the actual `limit` + `hasMore` contract.
- Added explicit unsupported-contract guards for features that the backend does not expose instead of sending fabricated requests.

## Exact backend endpoint families

Auth, users, sessions, security, connections, posts, stories, media upload sessions/assets, chats/E2EE devices, notifications, presence, live-streams, trust-rooms, battles, subscriptions, moderation and admin routes are enumerated in `docs/BACKEND_FRONTEND_CONTRACT.md`.

## Frontend endpoints requiring replacement

- `/auth/logout-all` → `/auth/logout` with `{allDevices:true}`
- `/api/connections/requests/:id/accept` → `/connections/:connectionId/accept`
- connection reject/cancel → unsupported; no backend route
- `/api/stories` feed → `/stories/feed`
- story `POST /view` → `GET /stories/:storyId`
- story reply → unsupported
- `/api/media/uploads` → `/media/upload-sessions`
- `/api/media/uploads/:id/cancel` → `/media/upload-sessions/:id/abort`
- `/api/media/playback-grants` → `/media/assets/:mediaId/playback-grants`
- `/api/live...` → `/live-streams...`
- `/api/security/devices...` → `/chats/trusted-devices...`
- `/api/chats` → `/chats` (canonical resolver now supplies `/api/v1`)
- `/api/notifications` cursor usage → `/notifications?limit=`

## Unsupported frontend features

- connection reject/cancel
- connection block/unblock
- user-specific posts endpoint
- user block/unblock endpoint
- story replies
- media list/albums
- security-device verify mutation
- separate story view mutation
- notification cursor pagination
- browser-authenticated WebSocket after normal login under the current backend handshake middleware

## Assumptions

- Production API origin is `https://gapak-api-production.up.railway.app` because that is the value in both supplied production examples.
- Vercel and Railway are cross-site, so production cookies require `Secure` + `SameSite=None`; the checked-in Railway example currently uses `lax` and therefore must be corrected in Railway environment configuration before live auth verification.
- No access token is ever put into a WebSocket URL.
- GAPAK E2EE is a custom protocol; the frontend does not label it Signal Protocol.

## Verification

`npm run lint`, `npm run typecheck`, and `npm run test:all` were attempted after the source changes.

The repository currently has no installed `node_modules`, so dependency-backed TypeScript/build execution is blocked until `npm ci` is run. The failure is not hidden or converted to a pass.

## Verification status

- `npm run lint`: **PASS**
- `npm run test:all`: **PASS — 65/65**
- `npm run typecheck`: **BLOCKED by missing dependencies** (`node_modules` is absent) and also exposes pre-existing/domain-layer compatibility errors caused by the frontend UI expecting richer legacy shapes than the authoritative backend DTOs. Those UI shape changes were intentionally not fabricated in this contract-only phase.
- `npm run build`: **not run to a meaningful build result** because Vite/dependencies are not installed in the supplied runtime.

The remaining TypeScript compatibility work belongs to the next domain-integration phase because it requires changing UI-facing assumptions (for example, backend connections return IDs rather than embedded sender/receiver user objects, and stories return a flat `StoryResponse[]` rather than the frontend's historical grouped story model). No fake objects were introduced to silence these errors.
