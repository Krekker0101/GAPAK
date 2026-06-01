# Gapak Backend

Production-oriented backend for the privacy-first social network `Gapak`.

## Product Vision

Gapak is not just a messenger. It is a large-scale privacy-first social network built around trust, layered identity, controlled visibility, secure media, live experiences, and time-based social interactions.

Gapak's core differentiator is that users do not have only one public identity. They can control multiple layers of themselves, who can access each layer, when content becomes visible, how long it stays visible, and under which trust conditions it can be consumed.

The platform must feel like a new category of social network:

- privacy is not a setting, but a core product mechanic;
- content is not only posted, but also revealed, unlocked, expired, gated, and experienced live;
- trust, timing, controlled access, and secure media are first-class platform primitives.

## Stack

- Go 1.24
- Fiber
- PostgreSQL
- Redis
- JWT access + refresh rotation
- Argon2id passwords
- TOTP 2FA
- Go-managed SQL migrations
- Docker / Docker Compose
- OpenAPI contract
- S3-compatible object storage foundation
- Redis-backed workers and realtime event channels

## Architecture

Project uses an octagonal modular structure around explicit boundaries:

- `cmd/api` - HTTP API entrypoint
- `cmd/worker` - background workers for media, stories, cleanup, replay jobs
- `internal/app` - bootstrap, routing, module wiring
- `internal/domain` - enums and core entities
- `internal/platform` - config, auth, crypto, middleware, database, cache, logging, queue, storage
- `internal/modules/*` - `controller/service/repository/dto`
- `internal/workers` - queue consumers and processing orchestration
- `db/migrations` - Go-managed SQL migration history
- `docs` - OpenAPI, API contract, architecture notes

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

## Auth Flow

- Access token is returned in JSON and expected in `Authorization: Bearer <token>`.
- Refresh token is cookie-friendly and issued in `HttpOnly` cookie `gapak_rt`.
- CSRF token is issued in `gapak_csrf` cookie and mirrored in response body.
- `POST /api/v1/auth/refresh` and cookie-based logout require `X-CSRF-Token`.
- Refresh tokens are stored hashed in `device_sessions`.

## Core Modules

1. Auth
- register
- login
- logout
- refresh token
- forgot/reset password
- 2FA setup
- 2FA verify

2. User
- profile
- edit profile
- visibility settings
- privacy layers for strangers / friends / trusted users

3. Post
- create / edit / delete posts
- privacy levels: public / friends / trusted_circle / private / one_time / timed
- media attachments
- feed-ready DTOs

4. Chat
- private dialogs
- chat list
- messages
- E2EE-friendly design
- message metadata without exposing plaintext

5. Trust Room
- create trust rooms
- roles
- access policies
- room-specific privacy and media rules

6. Session
- list active sessions
- revoke one session
- revoke all except current
- device-aware session tracking

7. Security
- device login alerts
- suspicious activity flags
- audit events
- panic mode to revoke sessions and reissue sensitive grants

8. Friend / Connection
- add / remove connection
- trusted circle
- secret sub-circles foundation

9. Media / Video / File
- secure file and media upload
- signed URLs architecture-ready
- direct-to-object-storage upload flow for large files
- resumable and multipart upload support
- encrypted media storage at rest
- secure media access grants
- adaptive media delivery architecture
- image, audio, and video attachment support
- safe attachment flow for posts, stories, rooms, profiles, and live replays

Video-specific requirements:
- after upload, every video must go through an asynchronous processing pipeline
- original uploaded video must not be used directly for public playback
- extract metadata: duration, size, codec, width, height, bitrate
- generate thumbnails, poster images, preview clips
- transcode into multiple streaming qualities
- split video into streaming-ready segments for adaptive delivery
- primary playback must use HLS/CMAF-ready architecture, not raw permanent file URLs
- playback must load very fast and adapt to the user's network quality automatically
- use small initial segments and pre-generated manifests for fast startup
- support 240p / 360p / 480p / 720p / 1080p variants where appropriate
- use short-lived signed playback access for protected/private media

Video encryption and secure delivery:
- encrypt video assets at rest
- support protected manifests and protected segment delivery
- use short-lived playback grants and permission checks before playback access
- private media must respect post privacy, story privacy, room access, one-time access, and timed access

Video safety and moderation pipeline:
- after upload, run automated safety checks before broad availability
- process extracted video frames, thumbnails, previews, audio metadata, and optional transcription for moderation signals
- detect and flag adult sexual content, explicit nudity, graphic abuse, illegal content, and unsafe media patterns
- support quarantine / restricted visibility / manual review states
- do not expose unprocessed media widely before safety pipeline finishes
- public media and sensitive/private media must support different moderation policies without breaking user privacy

10. Admin-safe moderation foundation
- reporting / flagging architecture
- no privacy-breaking moderation shortcuts

11. Social identity and trust mechanics
- multi-layer identity: public / friends / trusted / inner-circle
- layer-specific profile presentation
- trust-aware visibility rules
- trust levels and trusted circles
- secret sub-circles foundation
- temporary pass / one-time pass / timed unlock mechanics
- identity-aware feed and access logic

12. Stories
- photo and video stories
- default 24h lifecycle with optional timed expiry
- privacy: public / friends / trusted_circle / private / custom viewers
- viewers list with privacy-aware logic
- story replies and reactions
- highlights
- secure story media delivery
- lightweight fast-open story variants

13. Live streaming
- instant live and scheduled live
- host / co-host / guest roles
- live chat
- live reactions
- viewer count
- privacy-aware live rooms
- low-latency streaming architecture
- replay asset after live ends
- secure access-controlled live playback

14. Live battle / duel
- live challenge flow between users
- accept / reject / cancel challenge
- battle rooms with timer, rounds, score, audience voting, reactions
- replay, history, and leaderboard foundation
- anti-bot and anti-abuse protections
- trust-room battle mode

15. Unique social mechanics
- one-time posts
- timed posts
- timed unlock content
- private drops
- memory capsules
- ghost mode presence
- hidden online status
- vanishing comments
- vanishing media
- safe replay sharing with expiring access
- panic mode for sensitive account lockdown

## Important Product-Level Constraints

- Gapak must be designed as a real social network with unique product mechanics, not as a simple messenger with posts
- the platform's uniqueness must come from trust, layered identity, controlled visibility, secure media, timed content, and live social interaction
- media performance, privacy, and fast playback are first-class requirements
- anonymity and privacy must be implemented as real architectural principles, not as decorative claims
- moderation and safety must exist without destroying the privacy model

## Run Locally

1. Copy `.env.example` to `.env`.
2. If you use your local PostgreSQL instance, set:
   `DATABASE_URL=postgresql://YOUR_USER:YOUR_PASSWORD@127.0.0.1:5432/gapak?sslmode=disable`
3. Start local infra you need: PostgreSQL and optionally Redis/MinIO.
4. Apply schema locally: `go run ./cmd/migrate`
5. Run API: `go run ./cmd/api`
6. Run workers: `go run ./cmd/worker`
7. Open docs: `http://localhost:8080/api/openapi.yaml`

Notes:
- Redis is recommended for distributed rate limiting, fast queue dispatch, and live events, but the API and worker now remain operational in degraded mode without it.
- 2FA setup no longer depends on Redis: temporary TOTP setup challenges are stored as encrypted PostgreSQL records with TTL, session binding, and attempt limits.
- The default `REDIS_URL` uses logical database `/5` to reduce collisions with unrelated services on the same Redis instance.

## Automigration

- Docker startup already includes a dedicated `migrate` service that runs the Go migration binary before the API starts.
- Docker startup keeps migrations outside the request path and starts a dedicated `worker` service beside the API.
- Production-safe approach is to run migrations as a separate Go step/container, not from inside the request process.
- Initial SQL migration is committed in `db/migrations/20260418023000_init.sql`.
- For local PostgreSQL, use `go run ./cmd/migrate` or `make migrate`.
- `docker-compose.yml` explicitly overrides `DATABASE_URL`, `REDIS_URL`, and storage connection variables for containers, so local `127.0.0.1` settings in `.env` do not break container networking.

## Realtime And Media

- Direct uploads use upload-session contracts with short-lived signed part grants.
- Media processing jobs are persisted in PostgreSQL first; Redis is the fast dispatch layer, while workers can fall back to PostgreSQL polling if Redis is unavailable.
- Video assets are modeled for HLS/CMAF-ready delivery with variants, thumbnails, and playback grants.
- Live features now use a PostgreSQL-backed realtime outbox with stream-scoped event channels, cursor-based event reads, and Redis relay acceleration for future WebSocket or WebRTC gateways.
- Frontends can consume `GET /api/v1/live-streams/{streamId}/events?after=<sequence>` immediately, even when Redis is unavailable.
- Moderation remains privacy-safe: no ordinary moderation endpoint exposes private chat plaintext.

## Useful Commands

- `go test ./...`
- `go run ./cmd/api`
- `go run ./cmd/worker`
- `go run ./cmd/migrate`
- `make migrate`
- `docker compose up --build`