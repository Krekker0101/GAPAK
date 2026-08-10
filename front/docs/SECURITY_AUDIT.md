# GAPAK Front — Stage 5 Security Audit

Date: 2026-08-09

## Executive status

**Security foundation: IMPROVED / BACKEND-DEPENDENT**

This stage removes the previous fake cryptography and local security simulation. The frontend now uses browser Web Crypto primitives and server-backed security APIs. It does **not** claim full Signal/Double-Ratchet E2EE until the GAPAK backend satisfies the documented cryptographic protocol contract.

## P0 — resolved in frontend

### Fake encryption
- Removed `btoa()` / `atob()` from the chat crypto implementation.
- Removed deterministic/fake ciphertext, nonce, authentication-tag and key-envelope generation.
- Message encryption now uses ECDH P-256 + HKDF-SHA-256 + AES-256-GCM.
- Message signing uses ECDSA P-256/SHA-256.
- Private cryptographic keys are stored as non-extractable `CryptoKey` objects in IndexedDB.

### Fake security state
- Removed hardcoded sessions, alerts, audit events, 2FA secrets and panic metrics from `SecurityService`.
- Security Center is now backed by `/api/security/*` contracts.
- Panic Mode calls the backend before local emergency shutdown actions.

### Token/storage hygiene
- Access tokens remain memory-only.
- Refresh credentials are expected to be HttpOnly cookies.
- CSRF token state is memory-only rather than browser-storage persisted.
- Telemetry redacts authentication material, private/session keys, plaintext, email, phone and bearer credentials.

## P1 — implemented but backend-dependent

### Device identity
Frontend supports:
- per-browser cryptographic identity;
- ECDH agreement key;
- ECDSA signing key;
- public-key registration;
- device verification/revocation;
- local key destruction.

Backend must authenticate the device-registration request, bind keys to the authenticated account/device, and reject key substitution.

### Encrypted messages
The wire foundation contains:
- authenticated AES-GCM ciphertext;
- per-message ephemeral ECDH public key metadata;
- per-recipient key envelope metadata;
- sender signature;
- protocol version;
- device key identifier.

Backend requirements:
- never decrypt/store plaintext message content;
- authenticate sender device keys;
- validate recipient device membership;
- reject revoked/changed keys;
- enforce replay protection;
- enforce monotonic/unique message sequence semantics;
- rotate/revoke device key material;
- expose verified recipient bundles.

### Forward secrecy
The frontend generates a fresh ephemeral ECDH key pair per encrypted message. This is a cryptographic primitive supporting ephemeral key agreement, but **full forward secrecy and post-compromise security are not claimed** until the server/device protocol specifies key lifecycle, ratcheting, replay state and compromise recovery.

### Attachments
Encrypted attachment bytes can be created locally, but the secure media key-wrapping/upload contract is intentionally not used for network delivery in Stage 5. The chat UI refuses to send an encrypted attachment until the Stage 6 media protocol is available. This prevents raw attachment keys from being serialized into message payloads.

## P1 — backend security boundaries required

Frontend permission guards are UX only. The backend must enforce:

- `PUBLIC` visibility;
- `CONNECTIONS` visibility;
- `TRUSTED_CIRCLE` membership;
- `PRIVATE` ownership;
- chat membership;
- device ownership;
- security-admin authorization;
- session revocation;
- panic authorization;
- media authorization.

## XSS audit

- Mentions are rendered as React links without HTML injection.
- No `dangerouslySetInnerHTML` is used by the production text rendering path.
- User-generated URLs/content must still be validated by the backend and sanitized by any future rich-text renderer.

## CSRF

The HTTP client sends `credentials: include`. CSRF material is memory-only. The backend must use SameSite cookies and/or a CSRF token mechanism and expose the bootstrap token through an authenticated endpoint/header contract. The frontend must not read or persist the refresh cookie.

## Rate limits

The HTTP transport honors bounded retry policy and `Retry-After`. The backend should return `429` with a bounded retry delay. Mutation retries require an idempotency key.

## Panic Mode

On successful backend panic execution the frontend:
1. disconnects realtime;
2. clears chat subscriptions;
3. aborts active uploads;
4. destroys locally stored cryptographic keys;
5. dispatches an emergency media-stop event;
6. refreshes server security state.

The backend remains authoritative for session/grant/device revocation.

## Remaining blockers

1. Backend cryptographic protocol contract is required before claiming full E2EE.
2. Secure media key wrapping and upload protocol is required before encrypted attachments are enabled.
3. Backend must implement verified device-key registration, revocation and rotation.
4. Backend must enforce replay protection and message ordering semantics.
5. Backend must define CSRF bootstrap/rotation semantics.
6. WebAuthn/passkey registration still requires its backend challenge/attestation contract.

## No false security claims

The frontend must not label Base64, hex encoding, hashing, random identifiers, or local UI guards as encryption/security enforcement. This audit deliberately distinguishes cryptographic primitives from the complete end-to-end protocol.
