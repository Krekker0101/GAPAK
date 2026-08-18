# GAPAK Realtime

The frontend uses the backend native WebSocket endpoint at `/ws`; it does not use Socket.IO or a mock socket.

## Authentication and subscriptions

The client obtains a memory-only access token through the normal session refresh path before connecting. Chat subscription frames use the backend schema:

```json
{"type":"subscribe","data":{"chat_id":"...","after_sequence":123}}
```

The `after_sequence` field is included after a reconnect when the current tab has already applied an event for that chat. Unsubscribe uses the corresponding backend `unsubscribe` frame.

## Ordering and recovery

`RealtimeCursorStore` keeps the highest applied sequence per chat for the lifetime of the tab. Event routing validates backend frames, rejects stale sequences, deduplicates server event IDs and message identities, and never fabricates missed data. A full reload obtains message history from the HTTP cursor endpoint before realtime updates continue.

The backend is responsible for monotonically increasing per-chat sequences, stable event IDs, retained replay ranges and authorization.

## Outbound reliability

Chat and live-chat sends use a client-generated UUID both as correlation ID and `X-Idempotency-Key`. The UI exposes pending, sent and failed states. Failed content remains visible for retry. Encrypted chat envelopes can be queued in IndexedDB while offline and are flushed on reconnect; plaintext is not placed in that queue.

Live room data and chat history use `/live-streams` HTTP endpoints. Until the backend publishes live-room WebSocket events, the client refreshes that server state through TanStack Query and does not claim realtime delivery for the live domain.

## Transport safeguards

- one active socket with generation fencing;
- zombie-socket protection;
- bounded reconnect with jitter;
- idempotent desired subscriptions;
- runtime frame validation;
- event and message deduplication;
- no arbitrary offline WebSocket mutation queue.
