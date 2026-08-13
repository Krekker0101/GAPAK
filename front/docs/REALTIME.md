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

## Cursor / resync model (chats)

`RealtimeCursorStore` (`src/shared/realtime/CursorStore.ts`) tracks, per `chatId`, the highest `sequence` the client has successfully applied — from `history` pages and from `chat.message.*` events (`RealtimeManager.recordSequence` / `RealtimeManager.getCursor`). This is a **local, in-memory cursor**: it lives for the lifetime of the tab and is cleared on logout/dispose. It is not persisted to disk, so a full page reload starts with no cursor (a fresh `subscribe` with no `after_sequence`, i.e. "give me current state going forward").

On every `subscribe` — including the resubscribe that runs automatically after a reconnect (`RealtimeManager.resubscribeChats`) — the manager reads the stored cursor for that chat and, if present, sends it as `after_sequence` in the exact `{"type":"subscribe","data":{"chat_id":...,"after_sequence":...}}` shape the backend already accepts. There is no separate "resync" message type; recovery is the same `subscribe` contract, just replayed with a cursor.

```
socket closes -> WebSocketTransport reconnects -> RealtimeManager sees CONNECTED
  -> resubscribeChats() -> for each subscribed chatId:
       cursor = lastAppliedSequence.get(chatId)
       send({type:'subscribe', data: cursor ? {chat_id, after_sequence: cursor} : {chat_id}})
```

### What the client guarantees

- It will always ask to resume `after_sequence` on reconnect if it has ever applied a message for that chat in this tab session.
- It deduplicates by `eventId`, by `(chatId, messageId, type)`, and rejects any `chat.message.*` event whose `sequence` is not strictly greater than the last applied one for that chat (`RealtimeEventRouter.route`), so a backend that resends a range the client already has will not double-apply it.
- It never fabricates message history: if the socket cannot be resumed at all (see `error`/auth-failure handling), the client surfaces the disconnect state — it does not pretend messages exist that weren't received.

### What the backend must guarantee

- That `after_sequence` genuinely means "everything with `sequence > after_sequence` for this chat", with no gaps, for a duration bounded by the server's own retention/undelivered-message window.
- That `sequence` is monotonically increasing per chat and stable (never reused, never reassigned).
- That messages sent while the client is disconnected are retrievable via `history`/backfill once the client resubscribes with the correct cursor — the client cannot invent this data, it can only ask for it.

### TODO — live chat (`src/devtools/live`) has no resync endpoint

`src/devtools/live/LiveStreamService.ts` is a local, in-memory devtools mock: it does not open a WebSocket and has no `sequence`/cursor concept at all, so there is currently nothing to resync from after a reconnect for live-room chat. Before live chat moves off the mock, the backend needs to publish an equivalent contract to the one chats already have, e.g.:

```json
{"type":"subscribe","data":{"stream_id":"...","after_sequence":123}}
```

with `chat.message.*`-equivalent frames for live-room messages carrying a per-stream monotonic `sequence`. Until that endpoint exists, this file does **not** fake a resync — `LiveChatMessage`/`LiveStreamService` only carry client-side `clientMessageId`/`status` bookkeeping (see below) so the UI and retry plumbing don't need to change shape again once the real endpoint lands.

## Outbound message reliability (idempotency + pending/sent/failed)

Every outbound chat message carries a client-generated `clientMessageId` (a UUID) that doubles as:

- the optimistic-UI correlation id (`ChatMessage.id = 'pending:' + clientMessageId` until the server acknowledges), and
- the HTTP `X-Idempotency-Key` sent with `POST /chats/:id/messages` (`chatsApi.sendMessage`), so a retried send of the same message can never be double-created server-side.

Message state (`ChatMessage.state`) surfaces `sending` -> `sent`/`delivered`/`read`, or `failed` if the send is rejected after the existing HTTP retry-with-backoff policy (`shouldRetry`/`retryDelayMs` in `src/shared/api/retryPolicy.ts`) is exhausted. A `failed` message's `content` is never cleared — the composer's own draft text box is cleared on submit as normal input-UX, but the failed message bubble keeps the exact text the user sent so `onRetry` can resend the same encrypted envelope. If the browser is offline, the encrypted envelope is durably queued (`MessageSendQueue`, IndexedDB) and flushed on `online`/reconnect instead of being dropped.

Live-room chat (`src/devtools/live`) now carries the same `clientMessageId`/`status` (`pending | sent | failed`) shape on `LiveChatMessage` for forward compatibility, and `LiveStreamService.retryChatMessage` resends by the same idempotency key without touching the original text on failure. Because the mock has no real transport, a send there cannot currently fail or need genuine backoff — see the TODO above.

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
- chat sequence recovery via the cursor/`after_sequence` mechanism above;
- no offline replay of arbitrary WebSocket mutations.

Encrypted chat message durability remains on the HTTP E2EE transport and its IndexedDB queue.
