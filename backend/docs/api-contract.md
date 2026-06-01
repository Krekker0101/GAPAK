# Gapak REST API Contract

Base URL: `/api/v1`

## Product Vision

Gapak is not just a messenger. It is a large-scale privacy-first social network built around trust, layered identity, controlled visibility, secure media, live experiences, and time-based social interactions.

Gapak's core differentiator is that users do not have only one public identity. They can control multiple layers of themselves, who can access each layer, when content becomes visible, how long it stays visible, and under which trust conditions it can be consumed.

The platform must feel like a new category of social network:

- privacy is not a setting, but a core product mechanic
- content is not only posted, but also revealed, unlocked, expired, gated, and experienced live
- trust, timing, controlled access, and secure media are first-class platform primitives

## Response Envelope

Successful responses:

```json
{
  "success": true,
  "data": {},
  "meta": {
    "requestId": "..."
  }
}
```

Error responses:

```json
{
  "success": false,
  "error": {
    "code": "auth.invalid_credentials",
    "message": "Invalid credentials",
    "details": {}
  },
  "meta": {
    "requestId": "..."
  }
}
```

## Security And Privacy Requirements

Security and privacy requirements:

- password hashing only with Argon2id
- secure refresh token storage strategy
- HttpOnly-cookie-friendly or clearly defined hybrid auth flow
- brute-force protection
- CSRF/XSS/SQLi-safe design
- strict access control for private data
- no ordinary admin endpoint may read private chats or private media
- E2EE-friendly personal messaging architecture: server must not depend on storing plaintext messages
- separate session/device management
- suspicious login detection
- security alerts and audit events

Privacy and anonymity requirements:

- design the platform for maximum user anonymity and metadata minimization
- do not expose user IP addresses to other users, peers, or client-visible flows
- minimize IP and device metadata retention; store only what is necessary for security and abuse prevention
- support pseudonymous accounts and privacy-preserving identity layers
- implement privacy-relay / anonymous-access-ready architecture for high-anonymity access scenarios
- use encrypted transport everywhere and protect internal service-to-service communication
- separate public identity, login identity, device identity, and moderation/security identity where appropriate
- build audit and abuse controls in a way that does not break the privacy model
- do not claim fake anonymity; design real privacy-preserving architecture with minimized metadata, short-lived sensitive logs, secure tokenization, and compartmentalized identity data

## Auth

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `POST /auth/2fa/setup`
- `POST /auth/2fa/verify`

## Users

- `GET /users/me`
- `PATCH /users/me`
- `PATCH /users/me/privacy`

## Sessions

- `GET /sessions`
- `DELETE /sessions/{sessionId}`
- `DELETE /sessions/others`

## Security

- `GET /security/audit-events`
- `GET /security/flags`
- `GET /security/alerts`
- `POST /security/panic-mode`

## Connections

- `GET /connections`
- `POST /connections/requests`
- `POST /connections/{connectionId}/accept`
- `PUT /connections/{connectionId}/trusted-circle`
- `DELETE /connections/{connectionId}`

## Posts

- `GET /posts/feed`
- `GET /posts/{postId}`
- `POST /posts`
- `PATCH /posts/{postId}`
- `DELETE /posts/{postId}`

## Chats

- `GET /chats`
- `POST /chats/direct`
- `GET /chats/{chatId}/messages`
- `POST /chats/{chatId}/messages`

## Trust Rooms

- `GET /trust-rooms`
- `POST /trust-rooms`
- `POST /trust-rooms/{roomId}/members`

## Media / Video / File

- `POST /media/upload-sessions`
- `GET /media/upload-sessions/{sessionId}`
- `POST /media/upload-sessions/{sessionId}/parts`
- `POST /media/upload-sessions/{sessionId}/complete`
- `POST /media/upload-sessions/{sessionId}/abort`
- `GET /media/assets/{mediaId}`
- `POST /media/assets/{mediaId}/playback-grants`

## Stories

- `GET /stories/feed`
- `GET /stories/{storyId}`
- `GET /stories/{storyId}/viewers`
- `POST /stories`
- `POST /stories/{storyId}/reactions`
- `POST /stories/{storyId}/highlight`

## Live Streams

- `GET /live-streams`
- `GET /live-streams/{streamId}`
- `GET /live-streams/{streamId}/events`
- `GET /live-streams/{streamId}/chat`
- `POST /live-streams`
- `POST /live-streams/{streamId}/start`
- `POST /live-streams/{streamId}/end`
- `POST /live-streams/{streamId}/join`
- `POST /live-streams/{streamId}/chat`

## Battles

- `GET /battles`
- `GET /battles/{battleId}`
- `POST /battles`
- `POST /battles/{battleId}/respond`
- `POST /battles/{battleId}/votes`

## Moderation

- `POST /moderation/reports`
- `GET /moderation/reports`
- `GET /admin/moderation/reports`
- `POST /admin/moderation/reports/{reportId}/resolve`

## Social Identity And Trust Mechanics

- Multi-layer identity is modeled as a product primitive even when the current REST surface is still growing into it.
- Visibility decisions must stay compatible with `public / friends / trusted_circle / private / one_time / timed`.
- Feed, profile presentation, and access grants must remain trust-aware and timing-aware.
- Secret sub-circles, temporary passes, one-time passes, and timed unlock mechanics are part of the long-term API direction.

## Stories

- Stories are first-class social objects, not a side feature of chats.
- Story viewers, reactions, highlights, timed expiry, and secure media delivery are part of the contract direction.
- Lightweight story variants are expected for fast mobile opening and privacy-aware consumption.

## Live Streaming

- Live streams are privacy-aware rooms with host / co-host / guest roles, chat, reactions, viewer counts, and replay assets.
- Access-controlled playback and low-latency architecture are part of the platform contract, even if transport gateways evolve separately.
- Realtime live delivery is durable: events are written to PostgreSQL first, readable by cursor for polling frontends, and relayed through Redis when the relay path is available.

## Live Battle / Duel

- Battles are social interaction primitives with challenge flow, rounds, timer, score, voting, reactions, replay, and leaderboard foundations.
- Trust-room battle mode and anti-abuse controls are part of the design baseline.

## Unique Social Mechanics

- One-time posts, timed posts, timed unlocks, private drops, memory capsules, ghost mode, hidden online status, vanishing comments, vanishing media, safe replay sharing, and panic mode are core product mechanics.

## Upload Session Shape

`POST /media/upload-sessions` request:

```json
{
  "purpose": "POST_ATTACHMENT",
  "fileName": "clip.mp4",
  "mimeType": "video/mp4",
  "sizeBytes": 10485760,
  "checksumSha256": "optional-hex",
  "multipart": true,
  "partSizeBytes": 8388608
}
```

Response highlights:

- `id`
- `mediaFileId`
- `bucket`
- `objectKey`
- `status`
- `partGrants[].request.method/url/headers/expiresAt`

## Media / Video Architecture Notes

- Large files use direct-to-object-storage upload sessions and multipart/resumable flows.
- Video playback is expected to come from processed HLS/CMAF-ready assets, not raw permanent originals.
- Protected/private playback must use short-lived access grants and permission checks.
- Video safety review, quarantine, restricted visibility, and manual review states are part of the media lifecycle.

## Privacy Notes

- Private post and story media never exposes permanent raw storage URLs.
- Playback goes through short-lived grants from `POST /media/assets/{mediaId}/playback-grants`.
- `panic-mode` revokes sessions, playback grants, and pending upload sessions without introducing admin visibility into private chats.
- Personal chat payloads remain E2EE-friendly: server architecture depends on envelope metadata, not readable plaintext.
- Public identity, login identity, device identity, and moderation/security identity are expected to remain compartmentalized.
- Privacy and anonymity are architectural principles, not decorative product claims.

## Important Product-Level Constraints

- Gapak must be designed as a real social network with unique product mechanics, not as a simple messenger with posts
- the platform's uniqueness must come from trust, layered identity, controlled visibility, secure media, timed content, and live social interaction
- media performance, privacy, and fast playback are first-class requirements
- anonymity and privacy must be implemented as real architectural principles, not as decorative claims
- moderation and safety must exist without destroying the privacy model
