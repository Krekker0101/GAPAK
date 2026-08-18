# GAPAK Front — Phase 3 Report

**Phase:** Messaging + E2EE + Multi-device security
**Date:** 2026-08-12
**Status:** Frontend security hardening complete; full production E2EE remains backend-contract blocked.

## 1. Executive result

The messaging/security boundary was hardened around a deliberately named **GAPAK E2EE protocol v1**.

The implementation does **not** claim to be Signal Protocol or Double Ratchet.

The client now fails closed for trust, device identity, replay and unsupported backend security operations rather than pretending that incomplete backend state is secure.

## 2. What was changed

### E2EE protocol

- Introduced explicit `gapak-e2ee-v1` protocol identity.
- Removed the misleading `SIGNAL` protocol concept from the production message path.
- Added explicit protocol version validation.
- Added sender device ID to the authenticated message envelope.
- Added key version to the authenticated message envelope.
- Added a persisted sender-device monotonic message counter.
- Bound protocol version, sender device, message ID, sequence and key version into AAD/signature material.
- Kept AES-256-GCM for message encryption.
- Kept ECDH P-256 + HKDF-SHA-256 for per-recipient message-key wrapping.
- Kept ECDSA P-256/SHA-256 for sender-device signatures.
- Added strict wire-envelope validation.
- Rejected plaintext wire content.

### Trust model

The trust state is now exactly:

- `VERIFIED`
- `UNVERIFIED`
- `CHANGED`
- `REVOKED`
- `UNKNOWN`

Only `VERIFIED` recipient devices can receive encrypted messages.

A recipient user with multiple devices is accepted only if every backend-returned device is `VERIFIED`.

There is no automatic downgrade to `UNVERIFIED`, and no plaintext fallback.

### Multi-device

The frontend boundary now models per-device:

- identity key;
- agreement key;
- signing key;
- key version;
- trust state.

Recipient bundle resolution supports a backend response containing multiple devices per user.

The frontend still refuses to claim full multi-device security until the backend authenticates the device-key binding and exposes authoritative key version/revocation data.

### Device registration / rotation

The previous partial registration path could not safely bind the distinct identity/agreement/signing keys using the available backend contract.

It is now **fail-closed**:

- no partial device registration;
- no pretending local IndexedDB key generation equals server registration;
- no client-only authoritative rotation;
- no silent key replacement.

The required backend contract is documented in `docs/E2EE_SECURITY_MODEL.md`.

### Key storage

- IndexedDB schema increased to version 2.
- Private keys remain `CryptoKey` objects in IndexedDB.
- Message counters are persisted atomically in IndexedDB.
- Replay IDs are persisted per device.
- Deleting a device also removes its persisted message counter and replay state.
- `clear()` clears keys, counters and replay state.

### Replay / duplicate protection

- Every sender device receives a persisted monotonic sequence counter.
- Duplicate message IDs are rejected locally.
- The backend is explicitly required to enforce replay protection authoritatively.
- Message sequence and key version are part of authenticated envelope data.

### Offline queue

The old behavior:

`queue full → shift oldest message`

was removed.

The new queue:

- uses IndexedDB;
- stores already-encrypted envelopes only;
- never stores composer plaintext;
- has bounded item count and byte size;
- never silently evicts an old message;
- explicitly fails when full;
- removes a queued item only after successful server acceptance;
- keeps permanent failures available for explicit recovery;
- retries transient/network/server failures safely.

### Realtime

- Reconnect now passes through the authentication boundary before opening a new WebSocket.
- Arbitrary realtime mutations are no longer queued while disconnected.
- This prevents stale typing/ack/control events from replaying later.
- Message delivery remains owned by the durable encrypted HTTP queue.
- Existing server-issued event ID validation remains enforced.

### UI / trust state

Security UI now distinguishes:

- VERIFIED;
- UNVERIFIED;
- CHANGED;
- REVOKED;
- UNKNOWN.

Revoked devices are not offered a normal verification action.

Encrypted attachments are explicitly unavailable rather than being simulated. The composer now surfaces that failure instead of creating fake encrypted attachment state.

## 3. Files changed

### Security/crypto

- `src/domains/chats/crypto/CryptoProtocol.ts`
- `src/domains/chats/crypto/E2EECryptoEngine.ts`
- `src/domains/chats/crypto/DeviceCryptoManager.ts`
- `src/domains/chats/crypto/JsonWebKeyValidation.ts`
- `src/domains/chats/protocol/messageProtocol.ts`
- `src/domains/chats/api/cryptoApi.ts`
- `src/shared/security/deviceKeyStore.ts`

### Messaging/realtime

- `src/domains/chats/transport/MessageSendQueue.ts`
- `src/domains/chats/ChatsView.tsx`
- `src/shared/realtime/WebSocketTransport.ts`
- `src/shared/realtime/ConnectionManager.ts`

### Types/UI

- `src/shared/types/chat.ts`
- `src/domains/chats/TrustedDevicesModal.tsx`
- `src/domains/security/components/DevicesSection.tsx`
- `src/domains/chats/Composer.tsx`

### Documentation/tests

- `docs/E2EE_SECURITY_MODEL.md`
- `docs/PHASE_3_REPORT.md`
- `tests/phase3-e2ee.test.ts`

## 4. Contract changes

The frontend wire model now requires:

```text
protocolVersion = gapak-e2ee-v1
senderDeviceId
senderKeyId
ratchetCounter >= 1
keyVersion >= 1
ciphertext
12-byte nonce
recipient key envelopes
ECDSA signature
```

The recipient-device bundle must expose:

```text
userId
deviceId
identity public key
agreement public key
signing public key
trust state
key version
```

A multi-device response should contain all currently relevant devices for a recipient user.

### Important

These are frontend security-boundary requirements, not claims that the currently deployed Railway backend already implements them.

## 5. Tests added

`tests/phase3-e2ee.test.ts` covers:

1. GAPAK protocol is not mislabeled as Signal/Double Ratchet.
2. Trust policy is fail-closed for all non-VERIFIED states.
3. Offline queue cannot silently evict the oldest message.
4. Message protocol requires sender device, sequence and key version.
5. Deterministic safety-number hash vector.
6. Production crypto layer does not log plaintext/private-key material.
7. Multi-device recipient resolution requires every device to be trusted.
8. Realtime reconnect authenticates before opening a new socket and does not queue stale mutations.

### Test result

**31/31 static/contract/security-boundary tests PASS.**

## 6. Lint

`npm run lint`

**PASS**

## 7. Typecheck

`npm run typecheck`

**BLOCKED by repository dependency environment.**

The local `node_modules` directory is incomplete: packages including React, React Router, TanStack Query, TypeScript, Vite, Node types and Playwright are absent.

The resulting TypeScript errors are dependency-resolution errors, not a verified clean production typecheck.

This must be rerun after a successful `npm ci` in a networked/complete build environment.

## 8. Build

`npm run build`

**BLOCKED** because Vite is not installed in the available dependency environment (`vite: not found`).

No build-pass claim is made.

## 9. Integration / backend validation

A real cryptographic integration test against the production-like backend could not be completed because the supplied frontend project does not include the backend implementation or an authoritative E2EE device/key contract.

The following backend-dependent guarantees remain unverified:

- authenticated device registration;
- authenticated public-key binding;
- per-device recipient bundle completeness;
- server-authoritative trust transitions;
- device revocation enforcement;
- key rotation;
- key-version rollback prevention;
- server-side replay/counter enforcement;
- message acknowledgement/idempotency semantics;
- cross-device historical message synchronization;
- reconnect replay/cursor semantics;
- safe encrypted attachment key wrapping;
- secure recovery after device-key loss.

## 10. Security limitations explicitly documented

GAPAK E2EE v1 does **not** claim:

- Signal Protocol compatibility;
- Double Ratchet;
- X3DH/PQXDH;
- standardized post-compromise security;
- standardized forward secrecy equivalent to Signal;
- metadata privacy;
- secure account recovery by itself.

Per-message random keys and ephemeral ECDH wrapping improve key separation, but they do not turn the protocol into a ratchet protocol.

## 11. Remaining P0/P1 backend blockers

### P0

1. Backend must authenticate device-key registration.
2. Backend must expose all recipient devices and their exact key versions.
3. Backend must enforce trust/revocation server-side.
4. Backend must enforce message replay protection.
5. Backend must implement atomic key rotation/revocation.
6. Backend must implement idempotent message acknowledgement.

### P1

1. Recovery/re-enrollment semantics.
2. Cross-device message synchronization.
3. Realtime replay cursor/ack protocol.
4. Encrypted attachment streaming/key wrapping.
5. Formal cryptographic protocol review and independent security review.

## 12. Phase 3 conclusion

**Frontend security boundary: hardened and fail-closed.**

**Full production-grade multi-device E2EE: NOT YET VERIFIED.**

The correct next dependency is backend contract implementation/verification, not adding more client-side cryptographic primitives.

The project should continue to call the implementation **GAPAK E2EE protocol v1**, not Signal Protocol.
