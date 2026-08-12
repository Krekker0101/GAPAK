# GAPAK Notifications Integration Report

## Scope

Integrated the frontend Notifications domain against the actual backend contract:

- `GET /api/v1/notifications?limit=<n>`
- `GET /api/v1/notifications/unread-count`
- `POST /api/v1/notifications/:id/read`
- `POST /api/v1/notifications/read-all`

The backend response for list is `{ notifications, hasMore }` and exposes **no cursor or offset pagination**.

## Implemented

### Initial load

The shell loads the first page with `limit=20` and the unread count in parallel. Notification records are rendered only from the server response.

### Load more

The backend currently exposes only `limit`, so the frontend does **not invent a cursor, offset, page token, or synthetic pagination state**.

The UI starts with 20 items and, when `hasMore=true`, requests the server-supported maximum `limit=50`. Results are deduplicated by the backend notification `id`.

If 50 records have already been loaded while the backend still reports `hasMore=true`, the client stops exposing another load-more operation rather than repeatedly fetching the same dataset. True unbounded pagination requires a backend pagination primitive to be added later.

### Unread count

Uses the dedicated `/unread-count` endpoint. The value is not inferred from the visible list because the list may be incomplete.

### Mark read

The UI applies an optimistic local read state without inventing a timestamp. No `Date.now()` value is written into `readAt`.

After successful mutation, the list is reloaded so the authoritative server representation and server-provided timestamps are restored.

If the mutation or reconciliation request fails, the exact previous local state and unread count are restored.

### Mark all read

The same fail-safe optimistic pattern is used. The local unread count becomes zero immediately, but no synthetic read timestamps are generated. On success the server state is reloaded and the unread count is fetched again.

On failure, both the notification read state and unread count roll back.

### Duplicate protection

Notifications are keyed exclusively by their backend `id`. No client-generated notification IDs are created.

### Realtime reconciliation

The inspected backend WebSocket contract currently contains chat/realtime events only. It does **not** expose a documented notification event type.

Therefore the frontend does not subscribe to or fabricate an event such as `notification.created`, `notification.new`, or similar. HTTP remains the source of truth until the backend publishes a documented notification event.

The existing cross-tab `BroadcastChannel` read hint is not treated as a backend notification event and cannot create notifications.

## Security / correctness rules

- No fabricated notifications.
- No fabricated notification IDs.
- No fabricated server timestamps.
- No cursor invented on the client.
- No automatic mutation retry that could duplicate a state-changing request.
- Server response is authoritative after successful mutations.
- Failed mutations roll back optimistic local state.

## Tests

Added:

- notification merge/deduplication test;
- optimistic mark-read test verifying no fabricated timestamp;
- optimistic mark-all-read test;
- API contract test verifying all four backend endpoints and rejecting cursor/offset assumptions;
- boundary test verifying notification IDs/timestamps are server-derived.

The isolated notification unit suite passes **3/3** in the supplied runtime. Full TypeScript validation could not be completed in the archive sandbox because its `node_modules` are absent/incomplete; this is an environment/dependency-resolution limitation rather than a claimed clean full-project typecheck.

## Backend contract limitation

The current backend's `hasMore` response is based on `len(results) == limit`. Because there is no offset/cursor, the frontend cannot retrieve records after the first 50 without a backend contract extension. This report deliberately documents that limitation instead of hiding it behind fake pagination.
