# GAPAK Front — Media Integration Report

Date: 2026-08-12

## Scope

This phase connects the frontend to the real Railway media contract using only the resumable upload-session flow documented in `docs/BACKEND_FRONTEND_CONTRACT.md`.

## Implemented

- `POST /api/v1/media/upload-sessions`
- `GET /api/v1/media/upload-sessions/:sessionId`
- `POST /api/v1/media/upload-sessions/:sessionId/parts`
- `POST /api/v1/media/upload-sessions/:sessionId/complete`
- `POST /api/v1/media/upload-sessions/:sessionId/abort`
- `GET /api/v1/media/assets/:mediaId`
- `POST /api/v1/media/assets/:mediaId/playback-grants`

The frontend does not call the legacy upload-intent/finalize/access routes.

## Upload behavior

- Multipart upload is used for the new resumable flow.
- Each part is uploaded directly to the server-issued signed request.
- Part failures are retried independently with bounded attempts and jitter.
- Completed parts are retained in the active runtime and are not re-uploaded during resume.
- Upload sessions are refreshed from the backend before completion if the session is near/at expiry.
- Cancellation aborts active browser transfers and then calls the backend abort endpoint.
- `AbortSignal` is used for cancellation of control-plane requests and XHR upload cancellation.
- Progress is derived from actual XHR byte progress, not timers.
- SHA-256 is computed incrementally over bounded slices; the full file is never loaded with `file.arrayBuffer()`.

## Source of truth

The frontend does not fabricate:

- media IDs;
- media URLs;
- owner IDs;
- timestamps;
- privacy state;
- checksums;
- asset status.

Upload completion requires the backend `mediaFileId`.

Playback URLs come only from the backend `SignedRequest` returned by the playback-grant endpoint.

## Unsupported backend features

The current backend contract does not expose media-library listing or album endpoints. The previous frontend vault implementation called those unsupported routes. Those calls were removed rather than replaced with fabricated local data.

The media screen now supports:

- upload;
- upload progress/recovery;
- lookup of a known server-issued media ID;
- server-authorized playback for supported media.

## Security

- No access/refresh token is placed into signed URLs.
- Signed object-storage URLs are consumed exactly as returned by the backend.
- The frontend does not construct CDN URLs from bucket/object keys.
- No private key, token, or plaintext media payload is logged.

## Backend verification status

Frontend contract verification: **VERIFIED against the repository contract**.

Live Railway verification: **NOT VERIFIED in this phase**. No mock success was used.

## Remaining limitation

The active upload manager stores the `File` object in browser memory for the lifetime of the upload runtime. It supports pause/resume/retry within that runtime, but a browser reload cannot reconstruct the file automatically. Full crash/reload-resumable uploads would require durable browser storage of the user-selected file plus upload-session metadata (for example IndexedDB) and a recovery bootstrap. This is intentionally not faked.
