# GAPAK Realtime

GAPAK Front uses the backend's native WebSocket protocol at `/ws`.

## Backend contract

Authentication is completed by `RequireAuth` before the WebSocket upgrade. The browser uses the authenticated access session and the `/ws` access-token fallback when an Authorization header cannot be attached by the native WebSocket API.

The server emits JSON `WebSocketMessage` frames with backend-defined fields such as `eventId`, `chatId`, `messageId`, and `sequence`.

Chat events are:

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

Subscriptions use:

```json
{"type":"subscribe","data":{"chat_id":"..."}}
```

Recovery uses:

```json
{"type":"subscribe","data":{"chat_id":"...","after_sequence":123}}
```

The frontend does not use Socket.IO and does not send application-level ping/pong frames. Backend heartbeat is native WebSocket ping/pong.

## Reliability

The transport provides:

- single active socket;
- generation fencing;
- zombie socket protection;
- duplicate subscription prevention;
- bounded exponential reconnect with jitter;
- finite reconnect attempts;
- runtime frame validation;
- event ID deduplication;
- chat sequence recovery;
- no offline replay of arbitrary WebSocket mutations.

Encrypted chat message durability remains on the HTTP E2EE transport and its IndexedDB queue.
