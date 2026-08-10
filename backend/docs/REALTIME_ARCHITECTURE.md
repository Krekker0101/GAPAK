# GAPAK Realtime Architecture

## Goals

GAPAK realtime uses PostgreSQL as the durable source of truth, Redis as an instance-to-instance fan-out transport, and instance-local WebSocket connections as the final delivery layer.

```text
Client
  |
  | WebSocket
  v
API instance
  |                 +--------------------+
  | persist         | PostgreSQL         |
  +---------------->| messages           |
                    | realtime_events    |
                    +---------+----------+
                              |
                              | worker relay
                              v
                    +--------------------+
                    | Redis Pub/Sub       |
                    +---------+----------+
                              |
                 +------------+------------+
                 |                         |
              API #1                    API #2
                 |                         |
            local sockets             local sockets
```

## Lifecycle

`CONNECT -> AUTH -> SUBSCRIBE -> RECEIVE -> VALIDATE -> AUTHORIZE -> PROCESS -> PERSIST -> FANOUT -> ACK -> RECONNECT -> RECOVER`

### Connect/auth

- The existing HTTP auth middleware remains the primary authentication path.
- The legacy first-message `auth` flow remains supported for compatibility.
- Authentication has a bounded timeout.
- A connection has a unique internal connection ID separate from the client/device ID.
- Maximum concurrent connections per user: 5.
- Maximum subscriptions per connection: 100.
- WebSocket payloads are capped at 1 MiB at the protocol reader.

### Subscribe

A subscription always performs an object-level membership check before becoming active.

Clients may send:

```json
{"type":"subscribe","data":{"chat_id":"..."}}
```

For reconnect recovery:

```json
{"type":"subscribe","data":{"chat_id":"...","after_sequence":12345}}
```

The server returns messages with `sequence_number > after_sequence`, ordered by sequence.

### Message persistence

Chat messages are idempotent by `(chat_id, sender_id, client_message_id)`.

A successful message transaction writes:

1. message row;
2. message key envelopes;
3. attachments;
4. delivery receipts;
5. `realtime_events` outbox row.

The outbox row is committed atomically with the message transaction.

### Fan-out

The worker claims the durable outbox row and publishes the event to `chat:<chat_id>` in Redis.

Redis payloads contain identifiers and ordering metadata, not a second source of truth.

The WebSocket service subscribes to `chat:*` and fans events only to local connections that explicitly subscribed to that chat.

For `chat.message.created`, the receiving connection fetches the durable message through the authorized chat service. This keeps user/device-specific key envelopes protected.

### ACK

The sending connection receives an ACK after durable persistence. The ACK contains `ackFor` when the client supplied a message ID.

The persisted message event may still arrive through Redis. Clients must deduplicate by message ID/event ID.

### Ordering

Every chat message receives a monotonic `sequence_number` from the chat row. Redis transport order is not treated as authoritative.

Clients should:

- apply messages by sequence;
- detect gaps;
- reconnect/recover using `after_sequence` when a gap is detected.

### Backpressure

Each connection has a bounded queue of 256 messages. A full queue is treated as a slow-consumer condition and the connection is closed with `1013 Try Again Later` rather than allowing unbounded memory growth.

### Heartbeat

- Ping every 30 seconds.
- Pong/read deadline approximately 65 seconds.
- Write operations have a 10 second deadline.
- Idle/dead connections are closed by the protocol deadline.

### Ephemeral events

Typing and read-receipt events use Redis fan-out directly. They are not durable events and are not replayed after reconnect.

If Redis is unavailable, the current API instance still performs local fan-out. Durable messages remain recoverable from PostgreSQL.

### Offline recovery

A reconnecting client supplies its last applied chat sequence. The server queries PostgreSQL directly and returns all available messages after that sequence, capped at 100 per synchronization request.

The client repeats recovery until no gap remains.

## Failure behavior

### Redis unavailable

- New WebSocket connections continue if authentication/database dependencies are available.
- Durable messages are persisted.
- Cross-instance fan-out is temporarily unavailable.
- Local ephemeral fan-out is retained where possible.
- Reconnect/sequence recovery restores durable messages.

### Database unavailable

- Durable message sends fail.
- No ACK is emitted for an uncommitted message.
- Clients retry with the same `client_message_id`.

### Crash after commit, before ACK

The message and outbox row already exist. The retry uses the same idempotency key and returns the existing message. Recovery/fan-out can deliver it without creating a duplicate.

### Crash before commit

No message/outbox event is committed. The client retries using the same idempotency key.

### API instance crash

Local socket state is lost. Clients reconnect to any instance and recover using `after_sequence`.

### Slow consumer

The server closes the connection rather than buffering indefinitely. The client reconnects and recovers durable messages by sequence.

## Security invariants

1. A connection cannot subscribe without chat membership.
2. Every recovered message is loaded through the authenticated chat service.
3. Client-controlled chat IDs never bypass authorization.
4. Redis is transport only; it is not an authorization source.
5. A stale device connection cannot unregister a newer connection because registry identity uses an internal connection ID.
6. Message persistence precedes durable fan-out.
7. Duplicate sends do not allocate another chat sequence.

## Operational notes

Redis Pub/Sub is intentionally used only as a low-latency fan-out layer. It is not used for durable delivery. PostgreSQL `realtime_events` is the durable relay queue and PostgreSQL `messages.sequence_number` is the recovery cursor.

At very large scale, the first scaling boundary should be partitioning realtime channels/instances rather than introducing a new messaging platform prematurely.

## Additional chat events

Message edits and deletes also use the durable PostgreSQL outbox and Redis fan-out. The receiving instance reloads the authorized message rather than trusting event payload content.

Clients may acknowledge device-level delivery with:

```json
{"id":"client-event-id","type":"delivery_ack","data":{"chat_id":"...","message_id":"..."}}
```

The server verifies membership before writing the delivery receipt.
