# GAPAK Push Notification Implementation Report — 2026-08-13

## Implemented

- `PushProvider` abstraction.
- Web Push provider with VAPID and AES-128-GCM Web Push payload encryption.
- FCM HTTP v1 provider with service-account JWT/OAuth token exchange.
- APNs HTTP/2 provider with ES256 provider JWT.
- Authenticated device subscription API.
- AES-256-GCM encryption of registration token/auth secrets at rest.
- Duplicate subscription fingerprinting.
- Expiration and revocation handling.
- PostgreSQL transactional push outbox.
- One notification/subscription → one outbox row constraint.
- PostgreSQL `FOR UPDATE SKIP LOCKED` worker claims with lease fencing.
- Retry classification and exponential backoff.
- Dead-letter state.
- Invalid-token automatic subscription revocation.
- WebSocket notification delivery remains independent from push provider execution.
- Provider credentials stay in deployment secrets and are never stored in PostgreSQL.
- Integration tests for rollback, outbox creation, retry/dead-letter, invalid-token cleanup and concurrent claiming.

## New routes

`POST /api/v1/notifications/devices`

`GET /api/v1/notifications/devices`

`DELETE /api/v1/notifications/devices/:id`

## New database objects

`push_device_subscriptions`

`push_outbox`

Migration:

`db/migrations/20260813020000_push_notification_outbox.sql`

## Existing functionality preserved

The existing notification REST API, notification read/read-all flows, WebSocket notification events, domain event model and existing domain services were not replaced.

## Verification limitation

Repository-wide `go test` could not be completed in the current environment because dependency downloads did not complete before the execution timeout. `gofmt` passes for all Go files. Docker/PostgreSQL/Redis live runtime verification is also environment-dependent and was not falsely marked as complete.
