# GAPAK Push Notification Contract

## 1. Architecture

Push notifications use a transactional outbox. A domain mutation commits its `domain_events`, `notifications`, and push outbox rows in the same PostgreSQL transaction. No external push provider is called from the business transaction.

```text
business mutation
  -> domain event
  -> notification row
  -> realtime_events row
  -> push_outbox rows (one per active device subscription)
  -> COMMIT
  -> worker claims outbox
  -> provider adapter
  -> DELIVERED / retry / DEAD
```

WebSocket notification delivery is independent from push provider availability.

## 2. Device subscription API

### Register/update

`POST /api/v1/notifications/devices`

```json
{
  "deviceId": "stable-client-device-id",
  "platform": "web",
  "provider": "webpush",
  "endpoint": "https://push.example/endpoint",
  "publicKey": "base64url-p256dh",
  "authKey": "base64url-auth",
  "expiration": "2027-01-01T00:00:00Z"
}
```

For FCM/APNs use `token` instead of Web Push endpoint/publicKey/authKey.

The API is authenticated and CSRF-protected for browser mutations by the existing middleware.

### List

`GET /api/v1/notifications/devices`

Secret registration credentials are never returned. The response may include the Web Push endpoint because it is scoped to the authenticated owner; token/authKey are never returned.

### Revoke

`DELETE /api/v1/notifications/devices/:id`

Revocation is idempotent from the client's perspective. Pending push outbox work for the revoked subscription is dead-lettered.

## 3. Stored credentials

FCM/APNs device tokens and Web Push auth secrets are encrypted at rest with the existing GAPAK AES-256-GCM encryption key and user/device/provider AAD.

A SHA-256 credential fingerprint is stored only for duplicate-subscription detection.

No provider private key is stored in PostgreSQL. Provider credentials are process configuration/secrets.

## 4. Providers

### Web Push

Uses RFC 8291/RFC 8188-style `aes128gcm` payload encryption with browser `p256dh` + `auth` subscription material and VAPID authentication.

Required process secrets:

- `PUSH_WEBPUSH_VAPID_SUBJECT`
- `PUSH_WEBPUSH_VAPID_PRIVATE_KEY_PEM`

The VAPID public key is derived automatically if `PUSH_WEBPUSH_VAPID_PUBLIC_KEY` is omitted.

### FCM

Uses Firebase Cloud Messaging HTTP v1 with a service-account JWT exchanged for a short-lived OAuth access token.

Required process secrets/config:

- `PUSH_FCM_PROJECT_ID`
- `PUSH_FCM_CLIENT_EMAIL`
- `PUSH_FCM_PRIVATE_KEY_PEM`

### APNs

Uses Apple APNs HTTP/2 API authorization with ES256 JWT.

Required process secrets/config:

- `PUSH_APNS_TEAM_ID`
- `PUSH_APNS_KEY_ID`
- `PUSH_APNS_PRIVATE_KEY_PEM`
- `PUSH_APNS_BUNDLE_ID`

## 5. Delivery states

`push_outbox.status`:

- `PENDING`
- `PROCESSING`
- `DELIVERED`
- `DEAD`

Multiple workers use PostgreSQL `FOR UPDATE SKIP LOCKED` and a lease token. A worker crash leaves a reclaimable `PROCESSING` row.

## 6. Retry classification

Retryable:

- transport errors;
- HTTP 408;
- HTTP 429;
- HTTP 5xx.

Permanent:

- provider authorization/configuration errors;
- malformed payload/configuration.

Invalid subscription:

- Web Push 404/410;
- FCM invalid/not-found token responses;
- APNs 410, `BadDeviceToken`, or `Unregistered`.

Invalid subscriptions are revoked and their outbox work is dead-lettered.

Retries use exponential backoff with configurable limits.

## 7. Idempotency

One notification + one subscription can produce at most one push outbox row because of:

```text
UNIQUE(notification_id, subscription_id)
```

Domain-event/notification dedupe is preserved by the existing event/notification unique constraints.

Provider calls can be retried after an uncertain network outcome. Provider delivery itself is therefore treated as an at-least-once external side effect; duplicate provider delivery cannot be proven impossible at the network boundary. The backend guarantees no duplicate outbox work for the same logical notification/subscription.

## 8. Security

Push payloads contain notification metadata only. The backend must never put E2EE ciphertext, nonce, authentication tags, encrypted key envelopes, or plaintext message contents into push notifications.

Access to subscription CRUD is restricted to the authenticated owner.

## 9. Operational configuration

```text
PUSH_ENABLED=true
PUSH_PROVIDERS=webpush,fcm,apns
PUSH_WORKER_POLL_INTERVAL=2s
PUSH_WORKER_BATCH_SIZE=20
PUSH_WORKER_MAX_ATTEMPTS=8
PUSH_WORKER_BASE_RETRY=5s
PUSH_WORKER_MAX_RETRY=30m
```

Provider-specific credentials must be supplied as deployment secrets.

## 10. Failure semantics

If Redis is unavailable, PostgreSQL notification and push outbox persistence still succeeds. WebSocket delivery may be delayed, but push dispatch remains available through the database worker.

If a push provider is unavailable, the notification remains persisted and the push outbox retries according to policy. The REST notification API never reports push delivery as successful merely because the notification record exists.
