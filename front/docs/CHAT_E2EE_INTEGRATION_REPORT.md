# GAPAK Chat + GAPAK E2EE Integration Report

**Date:** 2026-08-12  
**Scope:** GAPAK Frontend chat transport, GAPAK E2EE protocol v1, trusted devices, pre-keys, offline delivery, and WebSocket reconciliation.

## Executive result

The Chat domain is now wired to the approved `/api/v1` backend contract instead of a nested/mock message envelope.

The client uses the name **GAPAK E2EE protocol v1**. It does **not** call this Signal Protocol and does not claim Signal/Double Ratchet/X3DH/PQXDH semantics.

The outbound message sent to the backend is a flat `SendMessageRequest`. Plaintext `content` is omitted from encrypted sends. The encrypted per-device key envelope is carried inside the backend's existing `keyEnvelopes[].encryptedKey` field so the DTO remains compatible without introducing a new backend field.

## 1. HTTP integration

Implemented routes:

- `GET /api/v1/chats`
- `POST /api/v1/chats`
- `GET /api/v1/chats/:chatId`
- `PATCH /api/v1/chats/:chatId`
- `DELETE /api/v1/chats/:chatId`
- `GET /api/v1/chats/:chatId/messages`
- `POST /api/v1/chats/:chatId/messages`
- `GET /api/v1/chats/messages/:messageId`
- `PATCH /api/v1/chats/messages/:messageId`
- `DELETE /api/v1/chats/messages/:messageId`
- `POST /api/v1/chats/trusted-devices`
- `GET /api/v1/chats/trusted-devices`
- `DELETE /api/v1/chats/trusted-devices/:deviceId`
- `POST /api/v1/chats/trusted-devices/:deviceId/pre-keys`
- `GET /api/v1/chats/pre-key-bundles/:userId`

`resolveApiUrl()` canonicalizes these to one `/api/v1` prefix, so no duplicated `/api/v1` is produced in production.

## 2. Backend SendMessageRequest compatibility

Encrypted sends are flattened to the backend DTO:

```text
clientMessageId
senderDeviceId
type
ciphertext
nonce
senderKeyId
encryptionProtocol
encryptionAlgorithm
associatedData
ratchetCounter
authenticationTag
metadata
replyToMessageId
keyEnvelopes
```

`content` is deliberately omitted. No nested `{ envelope: ... }` object is sent.

The backend compatibility enum is `TRUSTED_CHAT`; the cryptographic protocol identity remains `gapak-e2ee-v1` in the authenticated data/metadata. The client never labels this construction as Signal.

Each `keyEnvelopes[]` item uses the backend DTO fields exactly:

```text
recipientUserId
recipientDeviceId
keyId
algorithm
encryptedKey
nonce
keyVersion
```

The `encryptedKey` value is a JSON-encoded encrypted key-envelope containing the ephemeral public key, salt, wrapped message key, identity key ID, and protocol metadata. It contains no plaintext message body.

## 3. Device identity

The client never invents a backend device ID.

Registration flow:

1. Generate local cryptographic material.
2. `POST /api/v1/chats/trusted-devices`.
3. Read the server-issued `device.id`.
4. Bind local private keys to that server device ID.
5. Publish the browser's agreement public key through the approved pre-key endpoint.
6. Resolve the current device later by matching the locally-held public identity/signing keys to server-issued device records.

If the local identity cannot be unambiguously matched to exactly one backend device, sending fails closed.

## 4. GAPAK E2EE send pipeline

The production send path is:

```text
compose plaintext in memory
    ↓
resolve recipient users → backend per-device bundles
    ↓
verify every active recipient device is VERIFIED
    ↓
verify current sender device is VERIFIED
    ↓
verify local/server key identity matches
    ↓
generate random per-message AES-256-GCM key
    ↓
encrypt plaintext
    ↓
create per-recipient ECDH/HKDF wrapping key
    ↓
wrap the message key independently for every recipient device
    ↓
sign canonical envelope with sender-device signing key
    ↓
flatten to SendMessageRequest
    ↓
POST /api/v1/chats/:chatId/messages
    ↓
await server response
    ↓
decrypt/authenticate the acknowledged server message
    ↓
replace optimistic UI item with the authenticated server message
```

There is no plaintext fallback.

## 5. Trust enforcement

The only send-eligible state is:

`VERIFIED`

These states fail closed:

- `UNVERIFIED`
- `CHANGED`
- `REVOKED`
- `UNKNOWN`

For a multi-device recipient, every currently returned recipient device must be `VERIFIED`. This prevents silently encrypting to a subset of a user's registered devices.

## 6. Offline behavior

Offline persistence stores the already-encrypted `SendMessageRequest`.

The queue rejects requests containing plaintext `content`.

Queue properties:

- IndexedDB persistence.
- Stable `clientMessageId`.
- bounded item count and serialized size.
- no silent eviction.
- retry on reconnect/online.
- retryable network/server failures remain queued.
- permanent failures remain persisted for explicit recovery.
- duplicate queue insertion by the same client message ID is ignored.
- plaintext is never accepted by the queue.

The WebSocket layer does not queue arbitrary realtime mutations; encrypted message delivery remains owned by the durable HTTP queue.

## 7. WebSocket

Production WebSocket URL is:

```text
wss://RAILWAY_DOMAIN/ws
```

The frontend currently derives this from `VITE_WS_BASE_URL`.

Authentication uses the existing browser session/cookie authentication boundary before opening the socket.

Realtime messages are typed around the existing service event names:

- `message.new`
- `message.ack`
- `message.status`
- `message.updated`
- `message.deleted`
- `chat.subscribe`
- `chat.unsubscribe`
- `typing.update`
- `receipt.update`
- system heartbeat events
- connection/error events

Realtime envelopes now carry optional:

- `sequence`
- `messageId`
- `chatId`

Ordering/deduplication uses these identifiers when supplied.

## 8. Reconnect and reconciliation

On reconnect:

1. The socket re-authenticates.
2. Chat subscriptions are replayed.
3. HTTP encrypted-message queue flushes when connectivity returns.
4. Duplicate message events are rejected.
5. Older sequence values are rejected.
6. Server responses remain authoritative over optimistic UI state.
7. Chat/message queries are invalidated when server events indicate durable state changes.

The frontend does not treat a WebSocket event as durable proof of message persistence.

## 9. Incoming messages

Backend `Message` records are converted into the GAPAK E2EE wire envelope and authenticated before decryption.

The client:

1. resolves the sender's device bundle;
2. requires sender-device trust `VERIFIED`;
3. verifies the sender-device signature;
4. selects the recipient key envelope for the current backend device ID;
5. derives the wrapping key;
6. unwraps the per-message AES key;
7. verifies/decrypts the ciphertext;
8. applies local duplicate/replay protection;
9. only then exposes plaintext to the message UI.

If authentication/decryption fails, the UI shows an encrypted/decryption-failed state rather than plaintext fallback.

## 10. Tests added

Added:

- `tests/unit/gapak-e2ee-crypto.test.ts`
- `tests/unit/gapak-e2ee-device.test.ts`
- `tests/unit/gapak-e2ee-trust.test.ts`
- `tests/unit/gapak-e2ee-message.test.ts`
- `tests/unit/gapak-e2ee-offline.test.ts`
- `tests/unit/gapak-e2ee-realtime.test.ts`
- `tests/unit/gapak-e2ee-reconnect.test.ts`

Coverage includes:

- protocol identity;
- non-Signal naming;
- trust-state fail-closed behavior;
- plaintext rejection;
- backend DTO shape;
- per-device envelope mapping;
- device key generation;
- signing verification;
- stable idempotency IDs;
- offline plaintext rejection;
- duplicate realtime message IDs;
- sequence ordering;
- reconnect ordering reset.

## 11. Important backend contract boundary

The approved backend DTO is not a standardized ratcheting protocol.

The implementation therefore continues to make no claims of:

- Signal Protocol;
- Double Ratchet;
- X3DH;
- PQXDH;
- equivalent post-compromise security;
- equivalent forward secrecy guarantees.

The protocol remains **GAPAK E2EE protocol v1**.

## 12. Remaining backend-dependent limitations

The following must remain backend-authoritative:

1. server-side replay/counter enforcement;
2. server-side device membership enforcement;
3. server-side trust/revocation enforcement;
4. atomic key rotation and rollback prevention;
5. reconnect replay/cursor semantics if the WebSocket service exposes durable cursors;
6. encrypted attachment upload/key-wrapping contract;
7. secure account/device recovery.

The frontend intentionally does not fabricate these guarantees.

## 13. Release assessment

**Chat HTTP integration:** implemented.

**Encrypted outbound message contract:** implemented against the supplied `SendMessageRequest` DTO.

**Per-device encryption:** implemented at the frontend protocol boundary.

**Trust fail-closed:** implemented.

**Backend-issued device IDs:** enforced.

**Offline encrypted queue:** implemented.

**Realtime dedup/order/reconnect handling:** implemented.

**Standardized Signal/Double Ratchet claims:** explicitly not made.

**Encrypted attachments:** still blocked until the backend exposes the required media key-wrapping/upload contract.
