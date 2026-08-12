# GAPAK Frontend ↔ Backend Contract

**Authority:** current Go/Fiber router + controller DTOs/services in the supplied backend repository.

Precedence used for this document:

1. actual Go routes
2. controller DTOs/services
3. backend runtime configuration/middleware
4. backend OpenAPI/docs
5. previous frontend documentation

No endpoint listed here should be inferred from product UI or old frontend docs.

## 1. Base URL

The repositories are configured for the Railway origin:

`https://gapak-api-production.up.railway.app`

The REST API prefix is:

`/api/v1`

Therefore production REST calls are:

`https://gapak-api-production.up.railway.app/api/v1/...`

The frontend runtime config must contain the origin **without** `/api/v1` because the frontend resolver adds that prefix.

## 2. WebSocket

Backend route:

`wss://gapak-api-production.up.railway.app/ws`

Important browser limitation: the Go router protects `/ws` with `RequireAuth`, which reads only the HTTP `Authorization: Bearer ...` header. Browser `WebSocket` cannot set that header. The backend's first-frame `{type:"auth"}` flow exists inside the WebSocket service but is unreachable when the route middleware rejects the handshake first. OAuth callback additionally sets a short-lived `gapak_at` cookie, but normal login/register do not set that access-token cookie. Therefore authenticated browser WebSocket connectivity after normal login is **not contract-complete without a backend change or an equivalent browser-compatible handshake contract**. Do not put access tokens in the WebSocket URL.

## 3. Auth

| Method | Route | Request | Response |
|---|---|---|---|
| GET | `/auth/csrf` | none | `{csrfToken,hasSession}` |
| POST | `/auth/register` | `RegisterRequest` | `AuthResponse` |
| POST | `/auth/register-anonymous` | `RegisterRequest` server-forced anonymous | `AuthResponse` |
| POST | `/auth/login` | `LoginRequest` | `AuthResponse` |
| POST | `/auth/refresh` | optional `{refreshToken}`; normally cookie | `AuthResponse` |
| POST | `/auth/logout` | `{allDevices}` optional | `{accepted:true}` |
| POST | `/auth/forgot-password` | `{email}` | backend-defined success payload |
| POST | `/auth/reset-password` | `{token,newPassword}` | backend-defined success payload |
| POST | `/auth/2fa/setup` | none | `{secret,otpAuthUrl}` |
| POST | `/auth/2fa/verify` | `{code}` | `{accepted:true}` |
| POST | `/auth/2fa/disable` | none | `{accepted:true}` |
| GET | `/auth/oauth/:provider` | none | `{url}` |
| POST | `/auth/oauth/:provider` | `{code,state?}` | `AuthResponse` |
| GET | `/auth/callback/:provider` | provider redirect | HTTP redirect; not JSON API |

### Registration

Normal registration accepts optional email but **does not force anonymous mode**. The frontend must send `preferAnonymous: false` unless the user explicitly chose anonymous registration. Anonymous registration must use `/auth/register-anonymous`.

### Login

The backend requires `login` and `password`; `totpCode`, `deviceName`, and `deviceFingerprint` are optional request fields. If 2FA is enabled and no/invalid TOTP is supplied, the backend returns an auth error rather than a special `requires2FA` success response.

### Cookies / CSRF

- refresh cookie: `gapak_rt`
- CSRF cookie: `gapak_csrf`
- OAuth callback also sets `gapak_at` for a short lifetime
- browser API requests require `credentials: include`
- mutation CSRF uses `X-CSRF-Token` matching the CSRF cookie
- production Vercel → Railway is cross-site; backend configuration therefore requires `COOKIE_SECURE=true` and `COOKIE_SAME_SITE=none`
- `CORS_ORIGINS` must contain the exact Vercel origin, never `*` when credentials are enabled

The checked-in Railway example currently says `COOKIE_SAME_SITE=lax`; that is not valid for the cross-site Vercel production deployment and must be corrected in the Railway environment configuration.

## 4. Users

- `GET /users/me`
- `GET /users/:userId`
- `PATCH /users/me`
- `PATCH /users/me/privacy`
- `PATCH /users/me/theme`

There is **no** backend user-posts route and **no** `/users/:userId/block` route.

## 5. Sessions

- `GET /sessions`
- `DELETE /sessions/others`
- `DELETE /sessions/:sessionId`

## 6. Security

- `GET /security/audit-events`
- `GET /security/flags`
- `GET /security/alerts`
- `POST /security/panic-mode`

There are **no** security-device `/security/devices` routes and no device `verify`/`revoke` mutations there. Device lifecycle belongs to `/chats/trusted-devices`.

## 7. Connections

- `GET /connections`
- `POST /connections/requests` body `{targetUserId}`
- `POST /connections/:connectionId/accept`
- `PUT /connections/:connectionId/trusted-circle` body `{enabled}`
- `DELETE /connections/:connectionId`

There are **no** connection reject/cancel endpoints.

## 8. Posts / Feed

- `GET /posts/feed`
- `GET /posts/clips`
- `GET /posts/:postId`
- `GET /posts/:postId/comments`
- `GET /posts/:postId/likes`
- `POST /posts`
- `POST /posts/:postId/like`
- `DELETE /posts/:postId/like`
- `POST /posts/:postId/comments`
- `PATCH /posts/:postId`
- `PATCH /posts/comments/:commentId`
- `DELETE /posts/:postId`
- `DELETE /posts/comments/:commentId`
- `POST /posts/comments/:commentId/like`
- `DELETE /posts/comments/:commentId/like`

Feed supports page/limit and cursor. Cursor continuation is exposed by the backend as `X-Next-Cursor`.

## 9. Stories

- `GET /stories/feed?page=&limit=`
- `GET /stories/:storyId`
- `GET /stories/:storyId/viewers`
- `POST /stories`
- `POST /stories/:storyId/reactions`
- `POST /stories/:storyId/highlight`
- `DELETE /stories/:storyId`

`GET /stories/:storyId` records a view for another viewer. There is **no** `POST /stories/:storyId/view`.

There is **no** story reply endpoint.

## 10. Media

Authoritative resumable flow:

- `POST /media/upload-sessions`
- `GET /media/upload-sessions/:sessionId`
- `POST /media/upload-sessions/:sessionId/parts` body `{partNumber}`
- `POST /media/upload-sessions/:sessionId/complete` body `{parts:[{partNumber,etag,sizeBytes}]}`
- `POST /media/upload-sessions/:sessionId/abort` body `{reason?}`
- `GET /media/assets/:mediaId`
- `POST /media/assets/:mediaId/playback-grants` body `{reason,maxViews?}`

The create-session response may contain only the first three signed part grants. Missing parts must be requested through `/parts`.

The completion response is an `UploadSessionResponse`, not a fabricated media object and not a playback URL.

There is **no media list endpoint** and **no media albums endpoint** in the current backend.

Legacy endpoints exist but are not the preferred frontend flow:

- `POST /media/upload-intents`
- `POST /media/:sessionId/finalize`
- `GET /media/:mediaId/access`

## 11. Chats

- `GET /chats`
- `POST /chats`
- `GET /chats/:chatId`
- `PATCH /chats/:chatId`
- `DELETE /chats/:chatId`
- `GET /chats/:chatId/members`
- `PATCH /chats/:chatId/members/:userId`
- `DELETE /chats/:chatId/members/:userId`
- `GET /chats/:chatId/messages`
- `POST /chats/:chatId/messages`
- `GET /chats/messages/:messageId`
- `PATCH /chats/messages/:messageId`
- `DELETE /chats/messages/:messageId`
- `GET /chats/messages/:messageId/versions`
- `POST /chats/messages/:messageId/reactions`
- `DELETE /chats/messages/:messageId/reactions`
- `GET /chats/messages/:messageId/reactions`
- `POST /chats/messages/:messageId/read`
- `POST /chats/messages/:messageId/delivered`
- `POST /chats/:chatId/typing`
- `GET /chats/:chatId/typing`
- `POST /chats/:chatId/pinned`
- `DELETE /chats/:chatId/pinned/:messageId`
- `GET /chats/:chatId/pinned`

There is **no `/chats/direct` route**.

## 12. E2EE device APIs

- `POST /chats/trusted-devices`
- `GET /chats/trusted-devices`
- `DELETE /chats/trusted-devices/:deviceId`
- `POST /chats/trusted-devices/:deviceId/pre-keys`
- `GET /chats/pre-key-bundles/:userId`

The frontend protocol is **GAPAK E2EE protocol**, not Signal Protocol or Double Ratchet. The backend DTO still accepts the legacy string enum value `SIGNAL`, but that must not be used as a claim that GAPAK implements Signal.

## 13. Notifications

- `GET /notifications?limit=`
- `GET /notifications/unread-count`
- `POST /notifications/:id/read`
- `POST /notifications/read-all`

The list returns `{notifications,hasMore}`. There is no cursor parameter/response contract.

## 14. Presence

- `GET /presence/me`
- `GET /presence/users/:userId`
- `POST /presence/query`
- `POST /presence/heartbeat`
- `POST /presence/disconnect`

## 15. Live

- `GET /live-streams`
- `GET /live-streams/:streamId`
- `GET /live-streams/:streamId/events?after=&limit=`
- `GET /live-streams/:streamId/chat`
- `POST /live-streams`
- `POST /live-streams/:streamId/start`
- `POST /live-streams/:streamId/end`
- `POST /live-streams/:streamId/join`
- `POST /live-streams/:streamId/chat`

There is **no `/live` namespace** and no `/live/:id/playback-grant` route.

## 16. Trust Rooms

- `GET /trust-rooms`
- `GET /trust-rooms/:roomId`
- `POST /trust-rooms`
- `POST /trust-rooms/:roomId/members`

## 17. Battles

- `GET /battles`
- `GET /battles/:battleId`
- `POST /battles`
- `POST /battles/:battleId/respond`
- `POST /battles/:battleId/votes`

## 18. Subscriptions

The current router exposes `/subscriptions` operations including following, subscription requests, approve/reject, block/unblock, creator subscriptions, notification preferences, subscriber lists and stats. These are distinct from `/connections` and must not be used as substitutes for connection operations.

## 19. Moderation / Admin

Moderation:

- `POST /moderation/reports`
- `GET /moderation/reports`
- `GET /admin/moderation/reports`
- `POST /admin/moderation/reports/:reportId/resolve`

Admin dashboard/users/content routes are protected by backend permissions and are not general-user API contracts.

## 20. Response envelope

Success:

```json
{
  "success": true,
  "data": {},
  "meta": {
    "requestId": "...",
    "pagination": {}
  }
}
```

Errors:

```json
{
  "success": false,
  "error": {
    "code": "...",
    "message": "...",
    "details": {}
  },
  "meta": {
    "requestId": "..."
  }
}
```

HTTP `204` endpoints (for example notification read operations and some delete operations) return no JSON body.

## 21. Request IDs

Frontend sends `X-Request-ID`; backend also installs request-id middleware and exposes `X-Request-Id`. Error envelopes contain `meta.requestId`.

## 22. HTTP status / retry policy

- `2xx`: success
- `400`: validation/invalid cursor/request; do not retry
- `401`: authentication failure; one controlled refresh attempt for normal API calls, then stop
- `403`: authorization/CSRF; do not retry except a single CSRF recovery when the error is explicitly CSRF-related
- `404`: resource/route not found; do not retry
- `409`: state conflict; do not blind retry
- `410`: expired media upload session; refresh/restart according to media state machine
- `422`: if emitted by deployment/proxy validation, do not blind retry
- `429`: bounded retry only when operation is safe; honor `Retry-After`
- `5xx`: bounded retry only for safe/idempotent reads or mutations carrying a backend-supported idempotency key
- network timeout: same safety rule as 5xx

Do not retry a mutation merely because it has a client-generated idempotency key unless the backend contract actually consumes that key for the route.

## 23. Backend features that do NOT exist

The frontend must not call or fabricate:

- `POST /auth/logout-all`
- `POST /connections/:id/reject`
- `POST /connections/:id/cancel`
- connection block/unblock under `/connections`
- `POST /stories/:id/view`
- story reply endpoint
- `/media` list
- `/media/albums`
- `/media/playback-grants`
- `/security/devices`
- security device verify/revoke routes
- `/users/:id/posts`
- `/users/:id/block`
- `/users/:id/block` DELETE
- `/chats/direct`
- `/live`
- `/live/:id/playback-grant`
- notification cursor pagination

## 24. Assumptions / unresolved contract dependencies

1. Railway production URL is taken from the supplied frontend/backend production examples; live DNS/HTTP verification still requires the deployed environment.
2. Browser WebSocket authentication is currently blocked by `RequireAuth` requiring an Authorization header on the upgrade while browser WebSocket cannot set that header. No token-in-URL workaround is allowed.
3. The backend's custom E2EE implementation must be treated as GAPAK E2EE protocol. The accepted `SIGNAL` DTO enum is legacy naming, not protocol proof.
4. Frontend profile/post/connection UI currently expects richer joined user objects than several backend DTOs return. No fake joined user objects are permitted; later domain integration must explicitly fetch the required server resources.
