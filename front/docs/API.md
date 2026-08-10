# GAPAK Front — API Contract

Date: 2026-08-09

The frontend uses `src/shared/api/httpClient.ts` as the only production HTTP transport. Requests use `credentials: include`, memory-only access tokens, request IDs, cancellation, normalized errors and bounded retry. Mutations that may be retried require an idempotency key.

## Auth/session

- `POST /api/auth/login`
- `POST /api/auth/register`
- `POST /api/auth/register-anonymous`
- `POST /api/auth/2fa/verify`
- `POST /api/auth/refresh`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/auth/oauth/:provider/callback`
- `POST /api/auth/logout`
- `POST /api/auth/logout-all`
- `GET /api/users/me`

Refresh credentials must be Secure + HttpOnly and server-rotated. The frontend never accepts a refresh token as a JavaScript-managed field.

## Social/content

- `GET /api/posts/feed`
- `GET /api/posts/:postId`
- `POST /api/posts`
- `POST /api/posts/:postId/like`
- `DELETE /api/posts/:postId/like`
- `POST /api/posts/:postId/comments`
- `GET /api/users/:id-or-username`
- `PATCH /api/users/me`
- `GET /api/connections`
- `POST /api/connections/requests`
- `POST /api/connections/requests/:requestId/accept`
- `POST /api/connections/requests/:requestId/reject`
- `DELETE /api/connections/:userId`
- `GET /api/subscriptions`
- `POST /api/subscriptions/:userId`
- `DELETE /api/subscriptions/:userId`

Subscription endpoints exist as a service boundary but the production UI does not claim unsupported relationship mutations.

## Chat

- `GET /api/chats`
- `GET /api/chats/:chatId/messages`
- `POST /api/chats`
- `POST /api/chats/:chatId/messages`
- `PATCH /api/chats/:chatId/messages/:messageId`
- `DELETE /api/chats/:chatId/messages/:messageId`
- `POST /api/chats/:chatId/messages/:messageId/reactions`
- `GET /api/security/devices`
- `POST /api/security/devices/:deviceId/revoke`
- `POST /api/security/devices/:deviceId/verify`

## Notifications

- `GET /api/notifications`
- `GET /api/notifications/unread-count`
- `POST /api/notifications/:notificationId/read`
- `POST /api/notifications/read-all`

## Media

- `GET /api/media`
- `GET /api/media/albums`
- `POST /api/media/uploads`
- `GET /api/media/uploads/:uploadId`
- `POST /api/media/uploads/:uploadId/complete`
- `POST /api/media/uploads/:uploadId/cancel`
- `POST /api/media/playback-grants`

## Stories

Read/reaction/view/reply are implemented. Story creation is deliberately not simulated because the backend contract for `POST /api/stories` is not approved.

- `GET /api/stories`
- `GET /api/stories/:storyId`
- `POST /api/stories/:storyId/view`
- `POST /api/stories/:storyId/reactions`
- `POST /api/stories/:storyId/replies`
- **Dependency:** `POST /api/stories` for production story creation.

## Live

- `GET /api/live`
- `GET /api/live/:streamId`
- `GET /api/live/:streamId/chat`
- `POST /api/live/:streamId/playback-grant`
- WebSocket outbound `live.chat.send`
- WebSocket inbound `live.chat.message`
- WebSocket inbound `live.update`

## Security / E2EE

See `SECURITY.md` and `E2EE.md`. All device/security operations are server-authorized.

## Error contract

Preferred error envelope:

```json
{"error":{"message":"...","code":"STABLE_CODE","status":400,"requestId":"req_...","details":[]}}
```

Preferred success envelope:

```json
{"data":{},"meta":{"requestId":"req_...","timestamp":"..."}}
```
