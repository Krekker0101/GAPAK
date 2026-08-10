# GAPAK Backend Security Model

## Security posture

GAPAK Backend follows a defense-in-depth / Zero Trust model:

- every API request is authenticated when the route requires identity;
- authentication is not authorization;
- object access is authorized at the service/repository boundary;
- bearer tokens are type-bound and algorithm-bound;
- refresh tokens are rotated using an atomic compare-and-swap;
- password reset tokens are consumed atomically with the password update;
- sensitive mutations use CSRF double-submit protection when cookie authentication is involved;
- critical authentication rate limits fail closed when the distributed limiter is unavailable;
- production requires explicit secrets, HTTPS CORS origins, secure cookies and Redis;
- uploaded media is signed, size-limited and MIME-validated before processing;
- WebSocket subscriptions require chat access before state is changed;
- WebSocket errors never expose raw internal errors to clients;
- audit events are recorded for security-sensitive authentication operations.

## Trust boundaries

1. Browser/mobile client -> HTTP API.
2. Browser/mobile client -> WebSocket gateway.
3. API -> PostgreSQL.
4. API -> Redis.
5. API -> object storage.
6. Worker -> local media filesystem / object storage.
7. Worker -> ffmpeg / ffprobe.
8. API -> external OAuth providers.
9. Admin UI -> privileged admin endpoints.

Every boundary is treated as untrusted input and must validate identity, authorization, size and semantics.

## Authentication

Access tokens and refresh tokens are cryptographically separated. JWT parsing requires:

- expected issuer;
- expected audience;
- expected token type;
- HS256 only;
- known `kid`.

Unknown signing key IDs are rejected rather than falling back to the current key.

Refresh sessions store a hash of the refresh token and rotate it atomically. A rotation conflict is treated as replay and revokes the session.

## Authorization

Handlers provide coarse-grained route protection and permissions. Domain services must still authorize object identifiers using the authenticated subject. Examples include media ownership, chat membership and admin target operations.

## OAuth

OAuth uses:

- state cookie validation;
- PKCE S256;
- short-lived state/verifier cookies;
- secure cookies in production;
- verified provider email before linking an existing local account by email.

Unverified provider email claims are not trusted for account takeover-sensitive linking.

## Secrets

Production refuses built-in secrets and requires:

- explicit JWT access secret;
- explicit JWT refresh secret;
- password pepper;
- encryption key;
- storage signing secret;
- anonymity hash secret;
- Redis;
- explicit HTTPS application URL and CORS origins.

Secrets must never be written to logs, audit metadata, URLs or repository files.

## Media

Upload authorization is bound to an upload session owned by the authenticated user. Signed upload requests bind the MIME type to the signature and session. The completed object is inspected before acceptance.

Playback authorization binds the grant to the viewer and requested storage object. Object access is checked against the media record and generated video artifacts.

## WebSocket

WebSocket connections are authenticated before application messages are processed. Connections are bounded per user and messages are size-limited. Chat subscription requires authorization before the subscription is registered.

## Failure policy

Security-sensitive dependencies fail closed:

- Redis failure blocks critical auth rate limiting;
- production startup fails if Redis is unavailable;
- revoked access tokens cannot be accepted when revocation storage is unavailable;
- invalid signing keys and CSRF tokens are rejected;
- internal errors are not returned verbatim over WebSocket.
