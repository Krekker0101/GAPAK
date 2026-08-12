# GAPAK Production WebSocket Integration Report

## Scope

This integration connects GAPAK Front to the backend's **native WebSocket protocol** at:

`/ws`

No Socket.IO client, Socket.IO server, or generic Socket.IO envelope is used.

## Verified backend contract

The backend implementation was inspected before the frontend transport was changed.

### Authentication

`GET /ws` is protected by the same `RequireAuth` middleware used by `/api/v1`.

Authentication is accepted from:

1. `Authorization: Bearer <access-token>` for non-browser clients;
2. the HttpOnly `gapak_at` access cookie for browser clients;
3. a backend `/ws` query-token fallback exists for compatibility, but the production frontend intentionally does not use it.

The WebSocket handler itself no longer accepts a first-frame `auth` message. Authentication is complete before the WebSocket upgrade reaches the service.

The backend also validates the browser `Origin` against configured CORS origins.

### Frame format

The backend uses a JSON `WebSocketMessage`:

```json
{
  "id": "...",
  "type": "...",
  "data": {},
  "ackFor": "...",
  "eventId": "...",
  "chatId": "...",
  "messageId": "...",
  "senderId": "...",
  "senderDeviceId": "...",
  "sequence": 123,
  "clientMessageId": "..."
}
```

Not every field exists on every frame.

The frontend does not invent server event IDs, timestamps, or sequence values.

### Server event names

The chat WebSocket service currently emits:

- `history`
- `chat.message.created`
- `chat.message.edited`
- `chat.message.deleted`
- `chat.read_receipt`
- `chat.typing`
- `ack`
- `read_receipt_ack`
- `delivery_ack`
- `error`

Unsupported frontend event names such as `message.new`, `notification.new`, `live.update`, and `system.ping` are not treated as backend events.

### Subscription

Subscribe:

```json
{
  "type": "subscribe",
  "data": {
    "chat_id": "..."
  }
}
```

Reconnect/replay:

```json
{
  "type": "subscribe",
  "data": {
    "chat_id": "...",
    "after_sequence": 123
  }
}
```

Unsubscribe:

```json
{
  "type": "unsubscribe",
  "data": {
    "chat_id": "..."
  }
}
```

The backend checks chat membership before activating a subscription.

### Replay and ordering

Durable chat messages use the backend's monotonic `sequence_number`.

The frontend stores the last applied sequence per chat and supplies it as `after_sequence` after reconnect.

History is authoritative recovery data. Event ordering is rejected when a chat message event has a sequence less than or equal to the latest applied sequence.

### Event identity and deduplication

For server-generated realtime events the backend provides `eventId`.

The frontend deduplicates using the actual backend `eventId`.

Chat message events additionally use the backend `messageId` and chat scope as a duplicate guard.

No client-generated UUID is presented as a server event ID.

### Heartbeat

The backend uses native WebSocket control frames:

- server ping every 30 seconds;
- pong handler/read deadline approximately 65 seconds;
- write deadline 10 seconds.

The browser automatically participates in WebSocket control-frame pong handling.

The frontend therefore does **not** send invented `system.ping` or `system.pong` JSON messages.

### Backpressure

Backend queue depth is 256 messages per connection.

A slow consumer is closed with:

`1013 Try Again Later`

The frontend treats this as reconnectable.

### Close semantics

Relevant backend behavior:

- `1000` — normal closure;
- `1001` — endpoint/client going away;
- `1012` — service restart;
- `1013` — temporary overload / slow consumer;
- `1008` — policy/authentication-related closure where applicable.

A `RequireAuth` rejection occurs before the WebSocket upgrade, so browsers do not reliably expose the HTTP `401` as a WebSocket close code. The frontend therefore uses bounded reconnect attempts and delegates session recovery to the auth layer rather than retrying forever.

## Frontend lifecycle

The transport exposes exactly:

- `CONNECTING`
- `AUTHENTICATING`
- `CONNECTED`
- `RECONNECTING`
- `CLOSED`

### Single active socket

Every connection attempt receives a monotonically increasing generation ID.

A callback is ignored unless both:

- its generation equals the current generation;
- its socket object is still the active socket.

This prevents zombie sockets from:

- changing connection state;
- processing stale frames;
- triggering reconnects;
- mutating subscription state.

### Reconnect

Reconnect uses:

- bounded exponential backoff;
- random jitter;
- maximum 12 attempts;
- 30-second maximum base delay;
- reset after a stable 15-second connection.

No unbounded reconnect loop exists.

Authentication/session failures are terminal for the current connection lifecycle and are handed to the authentication boundary instead of creating an infinite retry loop.

### Unsafe mutations

The WebSocket transport never queues arbitrary realtime mutations while disconnected.

Chat message durability remains owned by the encrypted HTTP message queue. This prevents stale typing, receipt, or control messages from replaying after an arbitrary offline period.

### Duplicate subscriptions

`RealtimeManager` maintains:

- desired subscriptions;
- active subscriptions.

A chat is subscribed only once per active socket. After reconnect, active subscriptions are rebuilt from desired subscriptions using the latest stored sequence.

## Chat/E2EE interaction

The WebSocket is a realtime delivery/recovery channel, not the source of plaintext.

For durable chat events the backend reloads the authorized message through the chat service before sending it to the connection. This protects device-specific E2EE key envelopes from the Redis payload.

The frontend receives the encrypted message response and passes it through the existing GAPAK E2EE decryption path.

The WebSocket layer never persists plaintext.

## Security decisions

- No Socket.IO.
- No generic event aliases.
- No fake timestamps.
- No fake server event IDs.
- No invented device IDs.
- No first-frame authentication.
- No application-level ping/pong protocol.
- Origin validation on the backend.
- Authentication before WebSocket upgrade.
- Runtime validation before event routing.
- Bounded reconnect.
- Zombie socket protection.
- Sequence-aware recovery.
- Actual backend identifiers for deduplication.

## Validation

Frontend tests cover:

- backend frame parsing;
- runtime schema rejection;
- history parsing;
- event ID deduplication;
- stale sequence rejection;
- bounded reconnect;
- jitter;
- generation fencing;
- native WebSocket usage;
- absence of Socket.IO;
- absence of fake application heartbeat.

Backend tests cover preservation of the realtime event identifiers in outbound WebSocket frames.

The full backend suite remains dependent on the repository's required Go toolchain version. The report does not claim a full backend test pass unless that toolchain is available.

## Deployment

Set:

```env
VITE_WS_BASE_URL=wss://<RAILWAY_DOMAIN>/ws
```

The URL must point directly to the backend WebSocket endpoint.

Do not use:

```text
/socket.io
/ws/socket.io
/socket
```

The production transport connects directly to `/ws`.
