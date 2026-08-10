# GAPAK Front — Realtime

Date: 2026-08-09

## Transport

`VITE_WS_BASE_URL` is opened with subprotocol `gapak.realtime.v1`. Authentication is browser session/cookie based. Access tokens are never placed in the WebSocket URL.

## Lifecycle

- CONNECTING → CONNECTED → DISCONNECTED/RECONNECTING/OFFLINE.
- Exponential backoff with jitter is bounded to 12 attempts.
- `system.ping` / `system.pong` heartbeat runs every 20 seconds with a 10 second timeout.
- `online`, `offline` and `visibilitychange` listeners are removed on disconnect/dispose.
- Logout closes the socket and clears chat subscriptions.
- Reconnect re-subscribes active chats.

## Event safety

- Event IDs are deduplicated.
- Versioned streams reject stale/out-of-order versions.
- Unversioned events remain backend-order dependent and must be delivered in order by the server.
- Unknown event types are normalized to an error event rather than treated as trusted application data.

## Offline / retry

Chat message sends use an in-memory bounded queue and flush after reconnect/online. The queue never persists plaintext or crypto material. Receipt batching does not clear pending receipts unless the realtime send succeeds.

## Multi-tab

`BroadcastChannel` propagates logout and notification-read state across tabs. Each authenticated tab may maintain its own WebSocket connection; there is no leader-election/single-socket protocol yet.

## Backend dependency

The server must provide stable event IDs, monotonic versions where ordering matters, authenticated session handling, replay semantics after reconnect where required, and acknowledgements for message delivery/status.
