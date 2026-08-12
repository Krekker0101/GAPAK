# GAPAK Feed / Posts Integration Report

## Scope

Connected the frontend Feed/Posts domain to the authoritative GAPAK Go/Fiber backend contract. No backend changes, mocks, fabricated server state, or invented endpoints were introduced.

## Implemented contract

- `GET /api/v1/posts/feed`
- `GET /api/v1/posts/clips`
- `GET /api/v1/posts/:postId`
- `GET /api/v1/posts/:postId/comments`
- `GET /api/v1/posts/:postId/likes`
- `POST /api/v1/posts`
- `POST /api/v1/posts/:postId/like`
- `DELETE /api/v1/posts/:postId/like`
- `POST /api/v1/posts/:postId/comments`
- `PATCH /api/v1/posts/:postId`
- `DELETE /api/v1/posts/:postId`
- `PATCH /api/v1/posts/comments/:commentId`
- `DELETE /api/v1/posts/comments/:commentId`
- `POST /api/v1/posts/comments/:commentId/like`
- `DELETE /api/v1/posts/comments/:commentId/like`

## Pagination

The backend exposes feed continuation through the `X-Next-Cursor` response header. The HTTP transport now optionally exposes response headers to domain services, and `postsApi.feed()` converts that authoritative header into `{ items, nextCursor, hasMore }`.

The frontend does not invent offset semantics. `page`, `limit`, `contentType`, and `cursor` are passed only when supported by the backend DTO.

## Feed reliability

- Infinite loading uses the server cursor.
- Posts are deduplicated by authoritative `post.id`.
- TanStack Query cancellation protects against overlapping stale fetches.
- Pagination only continues when the server supplies a next cursor.
- Errors surface through the existing page/error UI; no fake empty success is substituted.

## Optimistic likes

Like/unlike updates only the authoritative backend fields already present in `PostResponse`:

- `isLiked`
- `likeCount`

The previous query state is retained for rollback on failure. The feed is invalidated after the mutation settles so the server remains authoritative.

Mutation idempotency keys are used for supported mutation operations.

## Comments

Create-comment requests now use the exact backend DTO:

```text
{ content, parentCommentId? }
```

No `body` / `parentId` aliases are sent to the backend.

Comments are fetched from `GET /posts/:postId/comments`. Author identity is represented by the server-provided `authorId`; no fabricated user object or avatar URL is generated.

## Post creation

The composer maps its UI values to the backend DTO:

- `standard` -> `POST`
- `clip` -> `CLIP`
- uploaded media -> real `mediaFileIds`
- privacy -> backend privacy enum
- timed expiry -> real `expiresAt`

UI-only audience tags are not sent as if they were backend `audienceUserIds`.

## Server state

The backend `PostResponse` does not contain embedded author profiles or media URLs. The frontend therefore does not fabricate them. Author identity uses the real `authorId`; media uses real `mediaFileIDs` and is not converted into fake CDN URLs.

## Unsupported assumptions deliberately not introduced

- no offset pagination
- no fabricated author profiles
- no fabricated timestamps
- no fabricated media URLs
- no fake comments
- no invented share/bookmark endpoints
- no invented post-hide/report endpoints

## Verification

- Contract tests: **40/40 PASS**
- Static lint: **PASS**
- Typecheck: **BLOCKED by environment** — required type-definition packages are not installed in the available runtime (`@types/node`, React types, Babel/ESTree types, etc.). This is not being represented as a source-level PASS.
- Live Railway verification: **not performed**; no backend success was simulated.

## Remaining verification

After a clean dependency install (`npm ci`), run:

```text
npm run typecheck
npm run lint
npm run test:unit
npm run test:contract
npm run test:integration
npm run build
```

A real staging/browser verification against the deployed Railway API is still required for production release.
