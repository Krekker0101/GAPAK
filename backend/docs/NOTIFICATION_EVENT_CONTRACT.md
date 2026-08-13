# GAPAK Notification / Domain Event Contract

## Canonical event envelope

Every domain event is backend-generated and persisted transactionally:

- `id`: UUID
- `eventType`: strict uppercase enum
- `aggregateType`
- `aggregateId`: UUID
- `actorId`: optional UUID
- `recipientUserIds`: UUID array
- `payload`: JSON object containing metadata only
- `sequence`: optional domain sequence
- `idempotencyKey`: unique backend idempotency key
- `correlationId`: request correlation identifier when available
- `occurredAt`: server-generated UTC timestamp

The backend never accepts a client-supplied event ID or event timestamp.

## Supported domain events

`USER_UPDATED`, `CONNECTION_REQUEST_CREATED`, `CONNECTION_REQUEST_ACCEPTED`, `CONNECTION_REMOVED`, `MESSAGE_CREATED`, `MESSAGE_EDITED`, `MESSAGE_DELETED`, `MESSAGE_REACTION_CREATED`, `MESSAGE_REACTION_REMOVED`, `MESSAGE_READ`, `STORY_CREATED`, `STORY_REACTION_CREATED`, `STORY_VIEWED`, `SUBSCRIPTION_CREATED`, `SUBSCRIPTION_ACCEPTED`, `LIVE_STARTED`, `LIVE_INVITE_CREATED`, `MEDIA_READY`, `TRUSTED_DEVICE_ADDED`, `TRUSTED_DEVICE_REVOKED`, `SECURITY_ALERT`, `SYSTEM_NOTIFICATION`.

## Notification persistence

Notification creation is transactionally coupled to the domain event. The unique `(user_id, dedupe_key)` constraint prevents duplicate notifications during retries or duplicate event emission.

Notification fields:

- `id`
- `type`
- `actorId`
- `recipientId` (represented by `user_id`)
- `entityType`
- `entityId`
- `title` (i18n key)
- `body` (i18n key)
- `data`
- `createdAt`
- `readAt`
- `eventId`
- `dedupeKey`

E2EE ciphertext, nonce, authentication tags, key envelopes and other secret cryptographic material are never copied into notifications.

## Realtime

Durable notification realtime events are written to `realtime_events` in the same DB transaction and relayed through the existing worker/Redis fan-out.

WebSocket event types:

- `notification.created`
- `notification.read`
- `notification.read_all`

Notification channels use `notifications:<userId>` and are authorized by the server against the recipient list in the event payload. Clients do not control recipient routing.

## Redis failure semantics

PostgreSQL remains the source of truth. If Redis is unavailable, notification persistence still commits. Realtime delivery may be delayed until the relay path is healthy again. No push/realtime delivery is reported as successful merely because persistence succeeded.

## Existing REST contract

The following routes remain unchanged:

- `GET /api/v1/notifications/`
- `GET /api/v1/notifications/unread-count`
- `POST /api/v1/notifications/:id/read`
- `POST /api/v1/notifications/read-all`

## Current emission coverage

The current backend emits events transactionally for the existing mutations that correspond to the canonical vocabulary: user profile updates, connection request/create/accept/remove, chat message create/edit/delete/reaction/read, story create/view/reaction, subscription request/accept, live start, media ready, and trusted-device add/revoke.

`LIVE_INVITE_CREATED` remains a defined canonical event type but is not emitted because the current backend exposes no live-invite mutation/endpoint to which it could be safely attached. No fabricated invite state is created.
