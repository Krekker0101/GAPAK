# GAPAK Frontend ↔ Backend Final Integration Audit

Date: 2026-08-12

## Scope

This audit re-compares the supplied GAPAK Frontend against:

1. `docs/BACKEND_FRONTEND_CONTRACT.md` from the frontend repository; and
2. the supplied real Go backend repository, with the Go router, DTOs, controllers, services, middleware and WebSocket service treated as authoritative when the document and code disagree.

Backend source was **not modified**.

## Findings fixed

### 1. Chat URL prefix mismatch
The HTTP transport already owns `/api/v1` canonicalization. Chat APIs were incorrectly sending `/api/v1/chats/...`, which could produce a double prefix. All Chat/E2EE API calls now use `/chats/...` and are resolved once by the transport.

### 2. Chat mutation call signatures
Frontend call sites were passing `chatId` into message reaction/delete functions whose backend routes are message-scoped. These were corrected to use the actual `/chats/messages/:messageId/...` contract. Typing now consumes the backend's `204 No Content` response type.

### 3. Trusted-device registration response
The backend returns `TrustedDeviceResponse` directly from `POST /chats/trusted-devices`. The frontend incorrectly expected `{ device: ... }`. This was corrected. Device IDs remain backend-issued.

### 4. WebSocket command/event contract
Frontend code was still emitting obsolete fabricated event types such as `typing.update`, `receipt.update`, and `presence.update`. These were removed. Chat typing and receipts now use the backend's actual command shapes:

- `typing` → `{chat_id,is_typing}`
- `read_receipt` → `{chat_id,message_id}`
- `delivery_ack` → `{chat_id,message_id}`

Incoming typing uses `chat.typing` and server data fields. No Socket.IO is used.

### 5. Optimistic message metadata
The optimistic chat row no longer fabricates a server message ID or server timestamp. It uses a clearly local `pending:<clientMessageId>` UI key, while the actual `clientMessageId` sent to the backend remains the UUID correlation value. Server `id`, `createdAt`, `sentAt`, and sequence metadata are taken from the acknowledged backend message.

### 6. Presence contract
The previous Presence implementation used nonexistent `PATCH /presence/me` and sent fabricated realtime presence events. It now uses the backend's documented `/presence/me`, `/presence/users/:userId`, `/presence/query`, and `/presence/heartbeat` boundaries. Heartbeat uses the authenticated backend session ID and `ACTIVE`/`IDLE`, matching the actual DTO.

### 7. Subscriptions contract
The frontend had stale `/api/subscriptions` endpoints and cursor pagination. The service now uses the actual `/subscriptions/following`, `/subscriptions/:creatorId`, `/subscriptions/:creatorId/status`, and related backend namespace. No cursor was invented.

### 8. Media ready state
The upload UI previously waited for a nonexistent client-side `mediaUrl` after upload completion. It now considers the upload server-complete only when the backend supplies `mediaFileId`; playback URLs continue to come only from backend signed playback grants.

### 9. Stale WebSocket tests
Tests were asserting an older, non-authoritative WebSocket URL/auth contract. They were updated to test the actual native transport and backend frame contract instead of preserving stale assumptions.

## Contract verification

### HTTP transport

- Relative API paths resolve to exactly `/api/v1/...`.
- Browser requests use `credentials: include`.
- Success envelopes are unwrapped from `{success,data,meta}`.
- Backend errors are parsed from `{success:false,error:{code,message,details},meta}`.
- `X-Request-ID` is generated for client correlation; server `meta.requestId` is preferred when present.
- `X-CSRF-Token` is sent on authenticated mutations.
- Unsafe mutations are not retried unless an idempotency key is present.

### Authentication

The supplied backend auth controller sets `gapak_at`, `gapak_rt`, and `gapak_csrf` as applicable. Frontend access tokens remain memory-only and refresh credentials are cookie-managed. Production cross-site cookies require `Secure` + `SameSite=None`; `Cookie Domain` is not set to the Vercel hostname.

The backend's checked-in default configuration is not itself proof of the Railway environment values. Live deployment verification remains outstanding.

### Chat + GAPAK E2EE

- Uses the backend `SendMessageRequest` fields directly.
- Plaintext is not included in encrypted message requests.
- `encryptionProtocol` is `TRUSTED_CHAT`; GAPAK documentation does not call this Signal Protocol.
- Per-device `keyEnvelopes` are generated for backend-issued device IDs.
- Only `VERIFIED` trust state is accepted for encrypted send/decrypt.
- Offline storage contains encrypted request envelopes only.
- Server acknowledgement is required before reconciliation.

### WebSocket

The actual backend service was inspected. It uses native WebSocket frames, server-issued event IDs, chat IDs and sequence numbers, history replay, subscriptions, and native ping/pong. Frontend runtime validation rejects unsupported frames. Deduplication uses server event IDs and message identity; sequence ordering is enforced per chat where provided.

### Notifications

The frontend matches `GET /notifications?limit=`, `/unread-count`, `/:id/read`, and `/read-all`. No cursor is claimed. Notification IDs and timestamps are server-owned. The backend WebSocket service does not expose notification events, so the frontend does not invent them.

### Media

The resumable upload flow matches `upload-sessions`, signed parts, complete/abort, asset lookup, and playback grants. No media library/albums endpoint is fabricated.

### Stories

The frontend uses feed/get/view-via-GET/viewers/create/reaction/highlight/delete. It does not call nonexistent story view/reply endpoints.

### Connections

The frontend uses list, request, accept, trusted-circle, and remove. Unsupported reject/cancel endpoints are not exposed.

### Live

The frontend uses `/live-streams`, durable `/events`, stream chat, create/start/end/join. No `/live` backend API namespace is assumed.

## Verification results

| Check | Result | Notes |
|---|---|---|
| Static lint | PASS | `npm run lint` → GAPAK static lint OK |
| Unit tests | PASS | 44/44 |
| Contract tests | PASS | 44/44 |
| Integration contract tests | PASS | 6/6 |
| `npm ci` | BLOCKED | Dependency installation could not complete in the sandbox environment |
| Typecheck | BLOCKED | Existing/incomplete dependency tree is missing multiple `@types/*` packages |
| E2E | BLOCKED | Playwright executable is unavailable in the supplied dependency tree; no staging URL was supplied |
| Build | BLOCKED | `vite` is unavailable because dependencies could not be installed completely |
| Backend live verification | BLOCKED | Railway hostname could not be resolved from the execution environment |

The blocked checks are environment/deployment limitations; they are **not reported as passes**.

## Backend live verification

A direct request to the configured Railway origin could not resolve DNS from the execution sandbox. Therefore this audit does **not** claim live authentication, CORS, cookies, CSRF, WebSocket WSS, OAuth, signed media, or browser behavior is production-verified.

Required staging verification must use a real browser against the deployed Vercel and Railway origins and verify:

- HTTPS and certificate validity
- exact `Access-Control-Allow-Origin`
- `Access-Control-Allow-Credentials: true`
- `gapak_at`, `gapak_rt`, and `gapak_csrf` cookie attributes
- cross-site `SameSite=None; Secure` behavior
- CSRF rejection/acceptance
- OAuth redirect/callback
- native `wss://.../ws` handshake and authentication
- WebSocket reconnect/replay/subscription behavior
- signed media upload/playback
- CSP and security headers
- real notification, chat, story, connection, and live API responses

## Verdict

# READY FOR STAGING

The frontend is **FRONTEND VERIFIED** against the supplied backend source contract and all executable unit/contract/integration checks available in this environment pass.

**BACKEND LIVE VERIFICATION BLOCKED**.

Therefore `PRODUCTION READY` is explicitly prohibited by the requested acceptance criteria. The next gate is real Vercel + Railway staging/browser verification.
