# GAPAK Backend WebSocket Production Report

## Scope

This hardening covers only the native WebSocket endpoint `/ws` and its backend realtime service. Socket.IO is not used or introduced. E2EE is intentionally out of scope.

## Before

| Area | Previous behavior | Risk |
|---|---|---|
| Browser authentication | Access cookie was already supported by the upgrade middleware, but the service still contained legacy query-token assumptions in comments/flow. | Contract ambiguity and credential leakage risk. |
| First-frame auth timeout | `context.WithTimeout` existed, but `ReadJSON` was not bounded by a socket read deadline. | Authentication could block beyond the intended timeout. |
| First-frame `device_id` | Token was validated, but `device_id` was optional and a generated placeholder ID could be used. | Device identity was not authoritative. |
| IDs | Connection/device ID helpers had timestamp fallbacks. | Could produce non-random fabricated IDs. |
| Duplicate subscriptions | Re-subscribing fetched and emitted history again. | Duplicate history and stale UI application. |
| Malformed JSON | Frame was logged and silently ignored. | Client could not distinguish invalid protocol input from a healthy connection. |
| Shutdown | No explicit WebSocket service shutdown hook. | Active sockets could outlive application shutdown. |
| Inbound rate limiting | Size limit existed; per-connection message-rate limit did not. | Abuse/backpressure risk. |
| Realtime fan-out | Events with missing IDs could be forwarded. | Violates deterministic event identity. |

## After

| Area | Hardened behavior |
|---|---|
| Browser authentication | `/ws` accepts the HttpOnly `gapak_at` access cookie through the upgrade middleware with exact configured Origin validation. No access token is accepted in the query string. |
| Non-browser authentication | Clients without browser cookies may authenticate with the documented first frame `{type:"auth",data:{token,device_id}}`. |
| Auth timeout | The first auth frame is bounded by the server WebSocket authentication timeout. The read deadline is applied to the actual socket operation. |
| Device validation | `device_id` is mandatory for first-frame authentication and must belong to the authenticated user and be active/trusted. |
| Credential handling | First-frame tokens are validated and discarded. Tokens are not logged, stored in connection state, persisted, or returned to clients. |
| Authentication failures | The upgraded connection closes with standard WebSocket close code `1008` (Policy Violation). |
| Protocol failures | Malformed first-frame JSON uses `1002` (Protocol Error). Oversized frames use `1009`. |
| Message size | Maximum inbound WebSocket frame: 1 MiB. |
| Rate limiting | Maximum 60 inbound application frames per connection per one-second window. Excess closes the connection with `1013` (Try Again Later). |
| Subscription | Chat access is checked before state change. Repeating the same subscription on the same connection is idempotent and does not emit duplicate history. |
| Replay | `after_sequence` is the official recovery cursor. PostgreSQL remains the source of truth; Redis is fan-out only. |
| Heartbeat | Native WebSocket Ping/Pong only. No JSON heartbeat event is introduced. |
| Malformed JSON after authentication | Returns the real `error` event with code `INVALID_JSON`; the connection remains usable. |
| Event IDs | Realtime durable/ephemeral events require a real server-generated event ID. Missing IDs are not fabricated and are not delivered. |
| Shutdown | Application shutdown explicitly closes active sockets with standard `1001` (Going Away) and stops the Redis subscriber. |
| Stale sockets | Read deadline is renewed by protocol Pong frames; dead peers are cleaned up when the deadline expires. |

## Official endpoint

`GET /ws` using the native WebSocket handshake.

### Browser authentication

The browser native WebSocket handshake sends the HttpOnly `gapak_at` cookie automatically when browser cookie policy permits it. The backend validates the request `Origin` against the configured exact allow-list. No access token is accepted in the query string.

### First-frame authentication

This path is for clients that do not authenticate with the browser access cookie.

```json
{
  "type": "auth",
  "data": {
    "token": "<access-token>",
    "device_id": "<server-issued-trusted-device-id>"
  }
}
```

The first frame must be `auth`. No application frame is accepted before authentication. `device_id` must be present and must belong to the authenticated user, must not be revoked, and must have trusted status.

Authentication is bounded by `10s` in production.

## Input contract

### Subscribe

```json
{
  "type": "subscribe",
  "data": {
    "chat_id": "<chat-id>",
    "after_sequence": 12345
  }
}
```

`after_sequence` is optional and is a non-negative integer. When absent, the backend returns the current recoverable history window. When present, the backend returns messages whose persisted `sequence_number` is greater than the supplied value.

The backend does not introduce a new cursor scheme for WebSocket replay.

### Unsubscribe

```json
{
  "type": "unsubscribe",
  "data": {
    "chat_id": "<chat-id>"
  }
}
```

### Message

```json
{
  "id": "<client-event-id>",
  "type": "message",
  "data": {
    "chat_id": "<chat-id>",
    "client_message_id": "<client-message-id>",
    "...": "existing chat message fields"
  }
}
```

The payload is passed through the existing validated chat service. Durable message identity and sequence are generated by the backend.

### Read receipt

```json
{
  "id": "<client-event-id>",
  "type": "read_receipt",
  "data": {
    "chat_id": "<chat-id>",
    "message_id": "<message-id>"
  }
}
```

### Delivery acknowledgement

```json
{
  "id": "<client-event-id>",
  "type": "delivery_ack",
  "data": {
    "chat_id": "<chat-id>",
    "message_id": "<message-id>"
  }
}
```

### Typing

```json
{
  "id": "<client-event-id>",
  "type": "typing",
  "data": {
    "chat_id": "<chat-id>",
    "is_typing": true
  }
}
```

## Server event contract

Only these application event types are produced by the current backend WebSocket service:

### `history`

```json
{
  "id": "<server-event-id>",
  "type": "history",
  "data": [
    "<existing Message DTO>"
  ]
}
```

### `ack`

```json
{
  "id": "<server-event-id>",
  "ackFor": "<client-event-id>",
  "type": "ack",
  "data": {
    "status": "accepted",
    "message": "<persisted Message DTO>",
    "client_message_id": "<client-message-id>"
  }
}
```

### `chat.message.created`

```json
{
  "id": "<durable-event-id>",
  "type": "chat.message.created",
  "data": "<authorized Message DTO>"
}
```

### `chat.message.edited`

Same envelope as `chat.message.created`, with the persisted edited message DTO in `data`.

### `chat.message.deleted`

Same envelope as `chat.message.created`, with the authorized persisted message DTO in `data`.

### `chat.read_receipt`

```json
{
  "id": "<event-id>",
  "type": "chat.read_receipt",
  "data": "<persisted read receipt DTO>"
}
```

### `chat.typing`

```json
{
  "id": "<event-id>",
  "type": "chat.typing",
  "data": {
    "user_id": "<user-id>",
    "chat_id": "<chat-id>",
    "is_typing": true
  }
}
```

### `read_receipt_ack`

```json
{
  "id": "<server-event-id>",
  "ackFor": "<client-event-id>",
  "type": "read_receipt_ack",
  "data": "<persisted receipt DTO>"
}
```

### `delivery_ack`

```json
{
  "id": "<server-event-id>",
  "ackFor": "<client-event-id>",
  "type": "delivery_ack",
  "data": "<persisted delivery receipt DTO>"
}
```

### `error`

```json
{
  "type": "error",
  "data": {
    "code": "<stable backend error code>",
    "message": "<safe public message>"
  }
}
```

Internal server errors are not exposed verbatim.

## Heartbeat

The transport uses native WebSocket Ping/Pong frames. The backend sends Ping every `30s`; the read deadline is refreshed by Pong and expires after approximately `65s` without a valid protocol heartbeat.

No JSON heartbeat event is part of the contract.

## Replay and ordering

The authoritative chat ordering field is the persisted `sequence_number` on the message. Redis publication order is not authoritative.

Clients recover gaps by reconnecting and subscribing with `after_sequence` equal to the last applied sequence for that chat.

The current server recovery window is bounded to the existing service limits; no alternative cursor mechanism is introduced by this hardening.

## Backpressure and limits

- Maximum connections per user: `5`.
- Maximum subscriptions per connection: `100`.
- Maximum inbound WebSocket frame: `1 MiB`.
- Maximum inbound application frames: `60` per second per connection.
- Outbound queue depth: `256` frames.

Slow consumers are closed with `1013`.

## Close contract

| Situation | Code | Meaning |
|---|---:|---|
| Server shutdown | `1001` | Going Away |
| Authentication/policy rejection after upgrade | `1008` | Policy Violation |
| Invalid protocol/auth JSON | `1002` | Protocol Error |
| Frame too large | `1009` | Message Too Big |
| Slow consumer / inbound rate exceeded | `1013` | Try Again Later |
| Normal established connection closure | `1000` | Normal Closure |

The backend does not invent custom close codes.

## Security properties

- Tokens are never logged by the WebSocket service.
- First-frame tokens are never stored in connection state.
- Query-string access tokens are not accepted.
- Browser handshake authentication uses the existing HttpOnly access cookie and exact configured Origin validation.
- Subscription state is created only after chat authorization succeeds.
- Realtime payloads are delivered only to subscribed, authorized connections.
- Redis is transport only; PostgreSQL/message service remains authoritative.
- Durable event/message identifiers are never fabricated as placeholders.

## Test coverage

Added/updated WebSocket production tests cover:

- handshake and native WebSocket connection;
- authentication success;
- authentication failure;
- authentication timeout;
- malformed first authentication frame;
- first-frame protocol enforcement;
- trusted-device validation;
- subscription;
- duplicate subscription;
- history replay with `after_sequence`;
- reconnect recovery;
- native Ping/Pong heartbeat;
- concurrent clients;
- connection cleanup;
- duplicate realtime event suppression through existing service tests;
- bounded message size;
- slow-consumer and rate-limit close behavior through the service path.

The test suite could not be executed to completion in the current offline environment because the Go module cache is incomplete and downloading dependencies from `proxy.golang.org` timed out. No claim of full green test execution is made in this environment.
