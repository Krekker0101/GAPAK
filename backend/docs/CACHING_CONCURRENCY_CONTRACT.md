# GAPAK HTTP Caching & Optimistic Concurrency Contract

## Scope

This protocol is additive and backward compatible. Existing clients may continue omitting `If-Match`. New clients should use `ETag` + `If-Match` for mutable resources.

## Versioned resources

`users/profile`, `connections`, `subscriptions`, `stories`, `live_streams`, and `media` maintain a backend revision in `entity_versions`.

Revision is server-authoritative, starts at `1`, is incremented transactionally after successful mutation, and never decreases. Soft deletes retain a tombstone revision.

## ETag

ETags are strong, opaque HMAC-signed validators:

`"gapak:<resourceType>:<revision>:<resourceId>:<signature>"`

The signature uses the server security secret. No secret resource fields are included.

### GET

Versioned entity GET responses include:

`ETag: "..."`

`Cache-Control: private, no-cache, must-revalidate`

`Vary: Authorization, Cookie`

Authenticated/private responses are never declared public-cacheable.

When `If-None-Match` exactly matches the current ETag (or is `*`), the server returns `304 Not Modified` with no JSON body.

### Mutations

Clients may send:

`If-Match: "..."`

The backend locks the authoritative revision row inside the same PostgreSQL transaction as the mutation. If the supplied revision is stale:

`412 Precondition Failed`

with:

```json
{
  "success": false,
  "error": {
    "code": "concurrency.version_conflict",
    "message": "The resource was modified by another request",
    "details": {
      "currentVersion": 7,
      "currentETag": "..."
    }
  }
}
```

When `If-Match` is omitted, existing legacy behavior is preserved for backward compatibility.

## E2EE

E2EE messages are excluded from this generic protocol. Their existing server-authoritative message sequence remains the concurrency primitive.

## Safety rules

- No response-body secrets are encoded into ETags.
- ETags are stable for a revision.
- 304 responses never expose a new representation.
- Deleted resources retain tombstone revisions for stale-write detection.
- Cache-control is private for authenticated data.

## Endpoint coverage

ETag/304 is enabled for entity GET endpoints:

- `GET /api/v1/users/me`
- `GET /api/v1/users/:userId`
- `GET /api/v1/stories/:storyId`
- `GET /api/v1/live-streams/:streamId`
- `GET /api/v1/media/assets/:mediaId`

`If-Match` is enforced on existing mutations when supplied:

- user profile/privacy/theme mutations;
- connection accept/trusted/remove;
- subscription type change/unsubscribe;
- story highlight/delete;
- live start/end.

Legacy clients that omit `If-Match` retain the previous mutation behavior.
