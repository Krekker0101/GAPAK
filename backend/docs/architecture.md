# Gapak Backend Architecture

## Product Vision

Gapak is not just a messenger. It is a large-scale privacy-first social network built around trust, layered identity, controlled visibility, secure media, live experiences, and time-based social interactions.

Gapak's core differentiator is that users do not have only one public identity. They can control multiple layers of themselves, who can access each layer, when content becomes visible, how long it stays visible, and under which trust conditions it can be consumed.

The platform must feel like a new category of social network:

- privacy is not a setting, but a core product mechanic
- content is not only posted, but also revealed, unlocked, expired, gated, and experienced live
- trust, timing, controlled access, and secure media are first-class platform primitives

## Octagonal Layout

The project follows an octagonal interpretation of modular backend architecture:

1. `entrypoint` - binary startup in `cmd/api`
2. `routing` - app bootstrap and route registry in `internal/app`
3. `controllers` - HTTP adapters in every module
4. `services` - use-case orchestration and policy
5. `repositories` - persistence adapters over PostgreSQL
6. `domain` - stable enums/entities for business language
7. `platform` - cross-cutting security, crypto, middleware, cache, config
8. `contracts` - SQL migrations, DTOs, OpenAPI, Docker, `.env`

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

## Important Product-Level Constraints

- Gapak must be designed as a real social network with unique product mechanics, not as a simple messenger with posts
- the platform's uniqueness must come from trust, layered identity, controlled visibility, secure media, timed content, and live social interaction
- media performance, privacy, and fast playback are first-class requirements
- anonymity and privacy must be implemented as real architectural principles, not as decorative claims
- moderation and safety must exist without destroying the privacy model

## SQL Migrations in a Go Runtime

The service uses Go repositories over PostgreSQL at runtime and a Go migration runner for schema evolution. This keeps the operational stack fully Go-native while preserving committed, reviewable SQL as the source of truth for database changes.
