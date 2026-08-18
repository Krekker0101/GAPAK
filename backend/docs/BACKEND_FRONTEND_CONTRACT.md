# GAPAK Backend ↔ Frontend HTTP Contract

**Status:** authoritative production HTTP contract for the current GAPAK frontend
**Date:** 2026-08-12
**Base path:** `/api/v1`

## Transport

All browser API calls use `/api/v1` and `credentials: include`. The current frontend sends `Authorization: Bearer <accessToken>` for HTTP authenticated requests; the backend also accepts the HttpOnly `gapak_at` access cookie. Browser unsafe mutations must send `X-CSRF-Token`; retry-safe mutations may send `X-Idempotency-Key`.

JSON success responses use:

```json
{
  "success": true,
  "data": {},
  "meta": {
    "requestId": "..."
  }
}
```

JSON error responses use:

```json
{
  "success": false,
  "error": {
    "code": "request.validation_failed",
    "message": "Request validation failed",
    "details": {}
  },
  "meta": {
    "requestId": "..."
  }
}
```

HTTP `204 No Content` is used for successful operations whose frontend contract does not consume a response body.

## Authentication

`POST /auth/register`, `POST /auth/register-anonymous`, `POST /auth/login`, `POST /auth/refresh`, password-reset endpoints and logout retain their existing route semantics. Auth responses contain real server-generated user/session identifiers, access token material, CSRF token and persisted expiration timestamps. The refresh token is never serialized into a JavaScript-readable JSON response. It is stored only in the HttpOnly refresh cookie `gapak_rt`. The access cookie `gapak_at` is also HttpOnly; current frontend HTTP requests may continue using the in-memory access token while the browser WebSocket uses the access cookie.

OAuth starts with `GET /auth/oauth/{provider}` and returns a provider URL. The provider callback is `GET /auth/callback/{provider}`. On success the backend establishes HttpOnly access (`gapak_at`) and refresh (`gapak_rt`) cookies and redirects to `OAUTH_FRONTEND_REDIRECT_URL`; the frontend should then call `GET /auth/csrf` and keep the returned CSRF token in memory. Browser mutations still require an exact configured CORS `Origin`. Production requires `COOKIE_SECURE=true`, `COOKIE_SAME_SITE=none`, and an empty `COOKIE_DOMAIN` for the Vercel-to-Railway deployment. CSRF is not a cookie. The current frontend does not expose `/auth/callback` as an application route.

## E2EE / trusted devices

`GET /chats/pre-key-bundles/{userId}` takes the recipient user UUID from the **path**. Query-string `userId` is not required and is not part of the current contract.

The trusted-device registration endpoint returns the real server-issued device ID. Pre-key publication uses that server-issued ID. The backend must never synthesize device IDs, key IDs that were not persisted, timestamps, or trust states in response to a failed operation.

## Subscriptions

`GET /subscriptions/following` returns the complete following list as a JSON array in `data`:

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "username": "real-username",
      "displayName": "Real Display Name",
      "avatarFileId": "uuid-or-omitted",
      "bio": "persisted bio",
      "subscriptionType": "VISIBLE"
    }
  ]
}
```

No cursor/page envelope is introduced for this endpoint. The current frontend does not consume one. The backend therefore loads the complete persisted list and returns an explicit server error if it cannot produce the complete response; it does not truncate silently or return placeholders.

## Idempotency

Authenticated mutations may carry `X-Idempotency-Key`. The backend stores the completed successful HTTP response for the key and replays that exact response on a later duplicate request. A duplicate request that arrives while the original mutation is still in progress receives `409 Conflict`.

A failed mutation does not remain permanently reserved by the idempotency layer; its key is released so the caller may retry. Redis unavailability does not create a fake success response and does not change domain behavior; the mutation proceeds normally without distributed deduplication.

## Health/readiness

`GET /health/live` returns a success envelope when the process is live.

`GET /health/ready` returns a non-2xx error envelope with `503 Service Unavailable` when a configured critical dependency is unavailable. A readiness failure is never represented as `success: true`.

## Authentication security

Production cookies are `Secure`, `HttpOnly`, `SameSite=None`; `COOKIE_DOMAIN` remains empty so cookies are host-only on Railway and are never scoped to a Vercel frontend domain. `POST`, `PUT`, `PATCH`, `DELETE` and other unsafe browser mutations require `X-CSRF-Token`. When a browser sends `Origin`, it must exactly match a configured CORS origin. CORS uses explicit origins only, with credentials enabled and no wildcard origin. The CSRF token is held only in application memory and sent as `X-CSRF-Token`.

WebSocket authentication is cookie-first for browsers: `/ws` validates the HttpOnly `gapak_at` access cookie and the exact `Origin`. No access token is accepted in the WebSocket query string. Browsers may also send a TLS-protected first-frame `auth` message with `browser_session=true`; the backend derives and validates the session ID from the signed access token instead of trusting a client device identifier. This fallback supports deployments where cross-site WSS cookies are blocked.

## Explicit non-goals

This contract does not add new mock endpoints, new frontend-only response shapes, cursor pagination to array-based frontend endpoints, a client-side device verification endpoint, or WebSocket protocol changes.


## WebSocket contract

See `docs/BACKEND_WEBSOCKET_PRODUCTION_REPORT.md` for the authoritative `/ws` protocol, authentication, events, replay, heartbeat, limits, and close semantics.

## GAPAK E2EE protocol v1 — authoritative chat contract

The production encrypted-chat implementation is the **GAPAK E2EE protocol v1**. This backend does not expose a standardized ratcheting protocol contract.

### `POST /chats/:chatId/messages`

Required production encrypted fields:

- `clientMessageId`: retry/correlation key; not authoritative message ID.
- `senderDeviceId`: backend-issued trusted device UUID.
- `type`.
- `ciphertext`: hex, 16..25000 bytes after decoding.
- `nonce`: exactly 12 bytes, hex encoded.
- `senderKeyId`: `<senderDeviceId>:identity:v1`.
- `encryptionProtocol`: `TRUSTED_CHAT`.
- `encryptionAlgorithm`: `GAPAK-E2EE-V1:AES-256-GCM+ECDH-P256+HKDF-SHA256+ECDSA-P256`.
- `authenticationTag`: exactly 64 bytes, hex encoded. In the current frontend this field carries the sender's ECDSA-P256 signature; it is not an AES-GCM tag.
- `keyEnvelopes`: one or more recipient-device envelopes.
- `content`: must be omitted or empty. Plaintext is never accepted as an encrypted-message bypass.

Backend authority:

- message `id` is generated/persisted by the backend;
- `sequenceNumber` is generated by the backend;
- `sentAt`, `createdAt`, and `updatedAt` are persisted by the backend;
- sender/recipient device ownership and trust state are server-authoritative.

### Trusted-device state

Canonical backend values are `TRUSTED`, `UNVERIFIED`, and `REVOKED`. Do not introduce a second backend trust enum for UI terminology.

### Prekeys

`GET /chats/pre-key-bundles/:userId` uses the path UUID. Expired prekeys are excluded. One-time prekeys are consumed transactionally on allocation. Public-key material is restricted to public EC P-256 JWKs and private key fields are rejected.

### Compatibility limitation

The current frontend crypto envelope authenticates a client-generated message UUID and client-created timestamp. The backend persists a server-generated message ID and timestamp. Because those values are part of the authenticated encryption/signature context, the existing frontend and the server-authoritative production contract cannot be made fully compatible by backend-only substitution without invalidating authenticated decryption. This is a contract limitation, not a reason to weaken server authority.
