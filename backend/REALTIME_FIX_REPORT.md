# GAPAK Realtime Hardening Report

## Implemented

- Instance-local WebSocket registry now uses unique connection IDs instead of device IDs, preventing stale disconnects from removing a newer connection.
- Per-user connection limit remains atomic under the registry mutex.
- Bounded per-connection send queue (256 messages) and slow-consumer close (`1013 Try Again Later`).
- Protocol read limit is enforced at 1 MiB.
- Authentication has a 10 second timeout.
- Ping/pong heartbeat and read/write deadlines are bounded.
- Presence sessions use unique connection IDs, preventing same-device connection races.
- WebSocket envelopes now support client message IDs and ACK correlation via `id` / `ackFor` while retaining existing fields.
- Chat subscription authorization remains object-level and is rechecked before history/recovery.
- Subscription count is capped at 100 per connection.
- Durable chat message outbox events are written in the same transaction as message persistence.
- Worker relay remains PostgreSQL-backed and Redis is used only for fan-out.
- Redis Pub/Sub subscriber reconnects after transport failure.
- Chat message/edit/delete events are relayed across API instances.
- Message events are reloaded through the authorized chat service, protecting user-specific E2EE key envelopes.
- Redis delivery duplicates are deduplicated per connection with a bounded ten-minute event cache.
- Reconnect recovery supports `after_sequence` and uses the monotonic chat sequence number.
- Typing/read-receipt events fan out across instances through Redis and include recipient user IDs.
- Delivery acknowledgements are supported over WebSocket and are authorization-checked by the chat service.
- Existing idempotency protection prevents a retry from allocating another message sequence or generating another realtime outbox event.
- Message persistence precedes durable realtime fan-out and ACK.

## Failure semantics

- Redis failure: durable sends still persist; cross-instance realtime may be delayed; clients recover through PostgreSQL sequence synchronization.
- DB failure: no durable message ACK is emitted.
- Crash after commit before ACK: retry with the same `clientMessageId` returns the existing message.
- Worker crash after Redis publish: duplicate relay is safe because connection-level event IDs are deduplicated.
- API instance crash: socket state is lost; clients reconnect and recover from PostgreSQL.
- Slow consumers are disconnected rather than consuming unbounded memory.

## Validation

`gofmt` was run over all modified Go files.

A full `go test`/race/build run could not be executed in the current sandbox because the project requires Go 1.24.13 while the sandbox has Go 1.23.2, and the Go 1.24.13 toolchain cannot be downloaded because outbound network access is disabled.

This limitation is intentionally reported rather than treating the test suite as passed.
