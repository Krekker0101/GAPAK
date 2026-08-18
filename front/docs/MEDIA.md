# GAPAK Front — Media

Date: 2026-08-12 (reload-resume persistence added; see "Reload resilience" below)

## Production flow

1. Browser calculates SHA-256.
2. `POST /api/v1/media/upload-sessions` returns server-authorized signed upload information.
3. Browser uploads directly using server-issued signed URL(s).
4. Multipart uploads use bounded concurrency and real XHR progress.
5. ETags are captured and sent to completion.
6. Backend finalizes processing.
7. Playback requires an expiring grant from the backend.

No sample CDN URLs, fake playback grants or timer-based progress are used in production.

## Reload resilience

A page reload used to lose all upload progress: the active `File` object and the
part/offset state lived only in memory (`GlobalUploadManager`'s in-memory
`runtimes` map). This is now mitigated for **multipart** uploads (single-shot
signed-URL uploads have no partial state to resume, so they are not persisted).

**What is persisted, and where.** As each part finishes uploading,
`GlobalUploadManager` writes a metadata snapshot to IndexedDB via
`UploadSessionStore` (`src/domains/media/UploadSessionStore.ts`, database
`gapak-media`, object store `upload-sessions` — same convention as the durable
chat outbox in `MessageSendQueue.ts`). The record holds `uploadId`, the file's
`name`/`size`/`mimeType`, a SHA-256 `contentHash` computed once at session
start, `completedParts` (`partNumber` + `etag`), the derived `offsetBytes`, and
the server-issued `expiresAt`.

**What is deliberately never persisted: the `File`/`Blob` itself.** Browsers
cannot reliably serialize an open file handle into IndexedDB across a reload —
attempting to would risk silent corruption or data loss. The user must
re-select the source file after a reload; everything above exists only to
verify that reselected file and skip re-uploading bytes the server already has.

**Reconciliation on reselect** (`GlobalUploadManager.reconcileRecoverableSession`,
pure decision logic in `uploadReconciliation.ts`), fail-closed at every step:

1. Cheap check: does the reselected file's name/size match the persisted
   record? If not → `FILE_MISMATCH`, no hashing performed.
2. Client-side TTL check against the persisted `expiresAt`. If already past →
   `EXPIRED` immediately, no network call, and the local record is discarded.
3. SHA-256 the reselected file and compare to the persisted `contentHash`. If
   it differs → `HASH_MISMATCH` (same name/size, different bytes — e.g. a
   re-exported or re-compressed file).
4. If all client-side checks pass, ask the server (`GET
   /media/upload-sessions/{uploadId}`) whether it still recognizes the
   session. If the request fails or the server's own `expiresAt` has passed →
   `EXPIRED`, local record discarded. **The server is always the final
   authority** — a locally-unexpired record is never treated as resumable
   without this round trip.
5. Only if all of the above pass is the session marked `RESUMABLE`: a runtime
   upload is rehydrated with the already-completed parts pre-populated, so
   `uploadParts` skips re-uploading them and only fetches signed URLs for the
   parts that are still missing.

No outcome is ever silently converted into "start a fresh upload" — each is
returned explicitly to the caller so the UI can say exactly what happened.

**UI.** `UploadRecoveryPrompt.tsx` runs once per app load: it reads any
leftover sessions via `loadRecoverableSessions()` (which also prunes anything
already past its local TTL) and, if any remain, opens a dialog asking the user
to re-select each file or discard it. `GlobalUploadCenter` (the floating
transfer-status widget) and `UploadRecoveryPrompt` are now both mounted in the
production `AppShell` — previously `GlobalUploadCenter` was wired only into
an internal-only screen and was invisible to real users.

**Persisted-record lifecycle.** A record is written after each completed
part and removed when the session reaches `READY` (success), `CANCELLED`
(explicit user or panic-reset cancellation), or is confirmed `EXPIRED` (either
by the live in-tab upload hitting an expiry error, or by reconciliation
finding the server no longer recognizes it). A `FAILED` in-tab session keeps
its persisted record, so it remains resumable after a reload too.

## Cleanup

- Upload abort controllers are removed after completion.
- Signed-upload abort listeners are removed after settlement.
- Video HLS instances are destroyed on source/unmount changes.
- Video control timers and observers are cleaned up.
- Preview Blob URLs are revoked on component cleanup.

## Backend dependency

Encrypted chat attachments still require per-recipient key wrapping, secure upload-session binding, encrypted thumbnail handling and authorized playback/decryption grants.
