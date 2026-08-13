# GAPAK Backend Domain API Production Compatibility Report

**Scope:** production compatibility hardening for the backend domain APIs **NOTIFICATIONS, MEDIA, STORIES, CONNECTIONS, LIVE**.

**Protocol terminology:** this report describes the existing GAPAK backend contracts only. It does not characterize any implementation as Signal Protocol or Double Ratchet.

## 1. Contract baseline

The reviewed request path is:

`Frontend request → backend route → request DTO → validation → service → repository → response DTO → canonical ErrorResponse`

Authentication is enforced by the shared `RequireAuth` middleware. Request validation uses the shared `httpx.BindQuery` / `httpx.BindBody` / UUID parameter helpers. Domain failures are returned as application errors and serialized by the shared Fiber error handler into the canonical `ErrorResponse` envelope.

The hardening work deliberately does **not** introduce a new pagination model, notification producer, synthetic storage URLs, fabricated identifiers, fabricated timestamps, or success responses for failed authorization/database operations.

## 2. NOTIFICATIONS

### Routes

- `GET /api/v1/notifications`
- `GET /api/v1/notifications/unread-count`
- `POST /api/v1/notifications/:id/read`
- `POST /api/v1/notifications/read-all`

### Compatibility result

The domain was moved from a controller-level direct SQL implementation to an explicit DTO → service → repository flow.

`GET /notifications` keeps the factual pagination model used by the backend: `limit` + `hasMore`. The repository fetches `limit + 1` rows and derives `hasMore` from the extra row, so a page containing exactly `limit` rows no longer incorrectly implies another page. **No cursor was added.**

`POST /:id/read` now distinguishes an already-read notification from a missing/not-owned notification. Missing or unauthorized ownership returns the canonical not-found error instead of an unconditional success response.

`POST /read-all` continues to be a real database update. Zero affected rows is treated as a valid no-op, not as fabricated work.

No notification generation/creation producer was introduced. The reviewed domain only reads persisted notifications and marks them read; no synthetic event source was added.

### Layers

- Request DTO: `ListQuery` with `limit` validation (`1..50`, server default `20` when omitted).
- Service: maps persisted notification records to `NotificationResponse`.
- Repository: real PostgreSQL queries for list/count/read state.
- Response DTO: `NotificationResponse`, `UnreadCountResponse`, plus existing `notifications` + `hasMore` list envelope.
- Errors: repository/service errors flow to canonical `ErrorResponse` through the shared error handler.

## 3. MEDIA

### Upload/session contract

Reviewed upload-session creation, retrieval, part authorization, completion, abort, media asset retrieval and playback grant issuance.

The existing service validation continues to enforce upload purpose, file name, MIME type, size and multipart sizing constraints. Completion validates the declared parts, finalizes the object through the storage abstraction, verifies the resulting object size/content type, then persists the real media/session state and a processing job.

Abort is now state-aware and checks the affected row count. Nonexistent/non-owned/invalid finalized sessions no longer become a successful abort response.

### Signed URLs

The service now validates every storage-generated signed request before exposing it to the API:

- URL must be non-empty.
- Expiration must be present and in the future.
- Method must be `GET` or `PUT` as appropriate.

Provider failure or an invalid signing result becomes `503 media.signed_url_unavailable`; it is never serialized as a successful empty URL.

The local storage implementation no longer substitutes synthetic `https://storage.local...` URLs when its public/protected base URL is missing. It now returns an unavailable signing result, which the media service converts to the canonical storage error.

### Authorization / ownership

The previous media accessibility query allowed any `READY` media to pass through solely because it was ready. That global READY shortcut was removed. Non-owner access now requires a real authorized reference through the existing avatar, message attachment, post-media or active story visibility rules.

Playback grants remain gated by `READY` state and the repository's real authorization/visibility checks. Grant expiration and max-view semantics continue to be persisted and enforced by the playback-grant flow.

### Legacy access

The old `Access` path previously returned a future `ExpiresAt` even though no corresponding real access grant was created. It now returns a canonical `410 media.legacy_access_deprecated` instead of fabricating access state.

## 4. STORIES

### Reviewed behavior

- create
- feed
- view
- viewers
- reactions
- highlights
- delete
- expiration

Story creation validates explicit expiration when supplied and rejects past expiration timestamps. Timed/private/one-time stories require an explicit audience; timed stories require an explicit expiration.

Visibility is enforced by the repository's real story visibility query. Viewing records a real view for non-authors. Reactions require an actually visible story and respect the stored `AllowReactions` flag.

Viewer listing was hardened so a nonexistent/non-owned story cannot silently become an empty viewer list. The repository first establishes that the story exists and that the requesting user is the author; only then can a legitimate zero-viewer result be returned.

Delete/highlight operations remain backed by real state-changing queries and ownership checks. Story feed visibility already filters expired/deleted stories.

## 5. CONNECTIONS

### Canonical routes

- `GET /api/v1/connections`
- `POST /api/v1/connections/requests`
- `POST /api/v1/connections/:connectionId/accept`
- `PUT /api/v1/connections/:connectionId/trusted-circle`
- `DELETE /api/v1/connections/:connectionId`

The existing route and repository semantics already matched the canonical connection/friend contract, so no alternate route family was introduced.

The service rejects self-requests before repository access. Repository operations remain ownership/state based and return errors when the target connection does not exist or the current user is not permitted to mutate it.

No fabricated connection IDs are generated by the HTTP layer; identifiers come from the persistent connection operation.

## 6. LIVE

### Reviewed behavior

- create
- start
- end
- join
- chat
- stream retrieval
- authorization
- ownership

Create with an explicit scheduled time now rejects a time that is not in the future. `TRUST_ROOM` creation requires the actual trust-room membership/hosting check.

Lifecycle transitions are state-aware:

- `SCHEDULED → LIVE` is allowed only for the owner while the row is actually `SCHEDULED`.
- `LIVE → ENDED` is allowed only for the owner while the row is actually `LIVE`.

Join and chat now require the stream to be actually `LIVE`. A scheduled or ended stream cannot be joined or used for new chat messages.

Visibility retrieval continues to use the existing repository authorization logic, so unauthorized stream access is not replaced with an empty response.

### Event pagination

Live events use the backend's factual sequence model (`after`, `limit`, `hasMore`, `nextCursor`). This cursor is **not** added to notifications; it remains only where the LIVE event contract already uses sequence-based replay.

## 7. Contract tests added

Domain contract tests were added for canonical route registration and representative DTO/service invariants:

- `internal/modules/notifications/contract_test.go`
- `internal/modules/media/contract_test.go`
- `internal/modules/stories/contract_test.go`
- `internal/modules/friends/contract_test.go`
- `internal/modules/live/contract_test.go`

The tests cover route compatibility, DTO validation, media signed-request rejection, story expiration semantics and connection self-request rejection.

## 8. Validation status

`gofmt` was run over all changed Go sources and tests.

A full `go test ./...` run was attempted, including targeted domain package tests. The execution environment timed out while Go was downloading/resolving dependencies, so a completed green test run could **not** be honestly claimed. The repository changes should therefore be treated as **code-reviewed and formatted, but not fully runtime-verified in this environment**.

## 9. Production compatibility matrix

| Domain | Frontend → Route | DTO / Validation | Service | Repository / state | Response | ErrorResponse | Pagination / lifecycle | Status |
|---|---|---|---|---|---|---|---|---|
| NOTIFICATIONS | 4 canonical `/notifications` routes | `ListQuery`, UUID param; limit 1..50 | Explicit notification service | Real list/count/read SQL; ownership on read | Notification DTOs + `notifications`/`hasMore` | Shared canonical envelope | **limit + hasMore only; no cursor** | **Hardened** |
| MEDIA | Upload session, parts, complete, abort, asset, playback routes | Upload size/MIME/purpose/part constraints | Explicit media service | Real upload/media/grant state; ownership + visibility | Upload/media/playback DTOs | Shared canonical envelope; signed URL failure → 503 | Signed URL expiration and storage validation | **Hardened** |
| STORIES | Create/feed/view/viewers/reactions/highlight/delete | DTO validation + expiration/audience semantics | Existing story service hardened | Visibility, expiration, ownership, viewer existence | Story/accepted DTOs | Shared canonical envelope | Expiration enforced; no fake viewer results | **Hardened** |
| CONNECTIONS | 5 canonical `/connections` routes | UUID + service semantics | Existing connection service | Ownership/status-aware mutations | Connection/accepted DTOs | Shared canonical envelope | Connection semantics preserved | **Compatible / hardened tests** |
| LIVE | `/live-streams` create/start/end/join/chat/events | DTO + scheduled-time validation | Lifecycle/auth state checks | Owner + status transitions + visibility | Live/event/chat DTOs | Shared canonical envelope | Sequence cursor remains only for LIVE events | **Hardened** |

## 10. Final assessment

The five requested domains now follow the same production-hardening principle: successful responses correspond to real persisted or cryptographically/signed-storage-backed state, authorization failures are not converted into empty success payloads, and the existing backend pagination models are preserved instead of being replaced by invented client-facing semantics.
