# Stories Integration Report

## Scope

Connected GAPAK Front Stories to the actual Railway backend contract without backend changes or fabricated server behavior.

## Actual endpoints

- `GET /api/v1/stories/feed` — page/limit pagination.
- `GET /api/v1/stories/:storyId` — opens a visible story and records a view for a non-owner on the backend.
- `GET /api/v1/stories/:storyId/viewers`
- `POST /api/v1/stories`
- `POST /api/v1/stories/:storyId/reactions`
- `POST /api/v1/stories/:storyId/highlight`
- `DELETE /api/v1/stories/:storyId`

## Explicitly unsupported

The frontend does not create or call:

- `POST /stories/:storyId/view`
- `POST /stories/:storyId/reply`

Reply UI was removed rather than replaced with fake success because the backend has no story-reply contract.

## Server source of truth

Story status, publication time, expiration time, view count, permissions, reactions, highlight acceptance, deletion and viewer records come from the backend. The frontend does not manufacture timestamps, IDs, media URLs or viewer objects.

## Media

Story media is resolved through the existing media contract:

1. `GET /media/assets/:mediaId`
2. `POST /media/assets/:mediaId/playback-grants` with `reason: STORY`

The signed playback URL comes from the backend. No public/CDN URL is fabricated.

## Pagination

Stories use the actual backend `page` + `limit` query. Cursor pagination was removed because the Stories backend DTO does not expose a cursor.

## Expiration

The frontend displays the backend `expiresAt` and only renders server-returned `ACTIVE` stories. It does not create or rewrite expiration timestamps.

## Identity

The Stories backend returns author IDs, not embedded user profiles. The frontend does not fabricate profiles. The current user's real profile is used only for the authenticated owner; another author's public profile is fetched on demand when opening a story.

## Tests

Added `tests/contract/stories-integration.test.ts` covering routes, DTO shape, unsupported endpoints, server timestamps, server-authorized media playback, viewers, reactions, highlight and deletion.

## Verification status

Contract tests were added but a complete dependency-backed TypeScript/build verification must still be run in an environment with installed npm dependencies. No backend success was simulated.
