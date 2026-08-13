# GAPAK Versioned Synchronization Protocol

## Endpoint

`GET /api/v1/sync?cursor=<opaque>&limit=<1..100>`

Authentication is required. Existing REST/WebSocket contracts are unchanged.

## Response

```json
{
  "success": true,
  "data": {
    "cursor": "<opaque snapshot cursor>",
    "nextCursor": "<opaque continuation cursor>",
    "hasMore": true,
    "changes": {
      "users": [],
      "connections": [],
      "chats": [],
      "messages": [],
      "notifications": [],
      "stories": [],
      "subscriptions": [],
      "live": []
    },
    "deleted": []
  }
}
```

## Cursor semantics

The cursor is opaque and HMAC authenticated with a server secret derived from the existing JWT access secret. It is bound to the authenticated user and contains:

- protocol version (`sync-v1`);
- snapshot revision;
- last applied revision;
- issued-at timestamp;
- per-user binding.

The cursor is **not** based on timestamps alone. A cursor older than 24 hours is rejected with `sync.cursor_expired`.

### Snapshot algorithm

1. First request captures `MAX(domain_events.revision)` as the immutable sync snapshot.
2. The server returns only revisions `> afterRevision AND <= snapshotRevision`.
3. New writes after the snapshot are excluded from that sync session.
4. While `hasMore=true`, continuation cursors preserve the same snapshot revision, preventing concurrent inserts from shifting the active pagination window.
5. When a snapshot is exhausted, `nextCursor` becomes a tail checkpoint (`snapshot=0, afterRevision=<lastRevision>`). The next request turns that checkpoint into a fresh snapshot, so idle clients do not get stuck on an old snapshot.

## Global revision

`domain_events.revision` is a monotonically increasing global revision independent from chat `sequence`.

Chat message ordering remains authoritative through the existing per-chat sequence protocol. The sync revision is only the cross-domain pagination boundary.

## Change object

```ts
interface SyncChange {
  id: string;
  entityType: "user" | "connection" | "chat" | "message" | "notification" | "story" | "subscription" | "live";
  operation: "upsert" | "readAll";
  revision: number;
  updatedAt?: string;
  deletedAt?: string;
  data?: Record<string, unknown>;
}
```

`revision` is authoritative ordering metadata. Revisions are monotonically increasing but may contain numeric gaps because PostgreSQL sequences are not rolled back; gaps do not represent lost events.

`updatedAt` and `deletedAt` describe entity state where available. Clients must use `revision` for synchronization ordering and must not use timestamps as a cursor.

For encrypted messages, synchronization may return ciphertext/encryption metadata required by the existing E2EE contract. Server-side plaintext is never fabricated for E2EE records.

## Deleted tombstones

Deleted resources are propagated through:

```json
{
  "id": "...",
  "entityType": "message",
  "revision": 12345,
  "deletedAt": "2026-08-13T12:00:00Z"
}
```

This lets a client remove stale local entities without re-fetching the entire collection.

## Authorization model

The sync ledger is not public. Events are returned only when the authenticated user is:

- the event actor;
- an explicit event recipient; or
- an authorized participant of the event aggregate (for example, a chat member, connection participant, or subscription participant).

The backend re-checks object ownership/participation when materializing current state.

## Legacy compatibility

The following legacy pagination/query parameters are untouched:

- `before`
- `cursor`
- `after_sequence`
- `page`
- `limit`

The new sync endpoint is additive and does not replace existing pagination.

## Error contract

Invalid cursor:

`400 sync.cursor_invalid`

Expired cursor:

`400 sync.cursor_expired`

Missing/invalid auth:

existing authentication error contract.

## Idempotency / retries

GET `/sync` is naturally retry-safe. Replaying the exact same cursor returns the same snapshot boundary. The response ordering is deterministic by `(revision, id)`.

## Concurrency guarantees

The protocol is designed to prevent page drift:

- inserts after snapshot do not appear in the active snapshot;
- updates after snapshot do not change the active revision range;
- deletes after snapshot are observed by a subsequent sync cycle;
- revisions are strictly ordered;
- the cursor never moves backwards;
- duplicate continuation requests are safe.

## Current coverage

The synchronization ledger currently consumes the existing domain-event platform for:

- users;
- connections;
- chat messages;
- notifications;
- stories;
- subscriptions;
- live streams.

Additional event types were added for notification reads, story deletion and live ending so those changes are not silently lost.

`domain_events` remains the durable source of cross-domain revision ordering.

## Important limitation

The sync endpoint materializes current row state for a revision. PostgreSQL does not retain historical versions of every mutable entity. Therefore a later update to the same entity may cause a continuation response to contain the entity's latest state even when the event revision being traversed is older. The revision stream itself remains gap-free and deterministic; clients should resolve final state using the highest received revision.

A future historical-version layer can provide exact point-in-time snapshots without changing this protocol.
