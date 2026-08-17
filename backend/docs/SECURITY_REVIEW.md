# GAPAK Backend — Independent Security Review

## Review posture

The review intentionally assumed previous hardening work could be incomplete or incorrect. The repository was inspected for authentication bypasses, object-level authorization, privilege escalation, concurrency hazards, media abuse, secret handling and distributed failure behavior.

## P0 / P1 findings fixed in this pass

| Severity | Finding | Root cause | Fix |
|---|---|---|---|
| P0 | OAuth bypassed local 2FA | OAuth callback issued a session directly for accounts with 2FA enabled | OAuth login/link now fails closed for 2FA-protected accounts and requires the password/TOTP login path |
| P0 | Subscription-request IDOR | Approve/reject accepted only `requestID`; creator identity was not checked | Service/repository now require the authenticated creator and approval is atomic |
| P0 | Trust-room role escalation | Caller-selected `OWNER`/`ADMIN` role was written after only checking caller's role | Ownership transfer is forbidden; room admins cannot mint admins |
| P0 | Live participant privilege escalation | Any viewer could request `HOST`, `CO_HOST` or `MODERATOR` | Join role is server-authorized; non-hosts can only join as viewer/guest |
| P1 | Chat persistence was not actually atomic | Service opened a transaction, but `CreateMessage` opened and committed a nested transaction | Added `CreateMessageInTx`; message, envelopes, attachments, receipts and realtime outbox now share the caller transaction |
| P1 | Chat attachment IDOR | Foreign key proved only existence of media, not ownership | Sender must own finalized media and thumbnails before attachment |
| P1 | Comment-like IDOR | Like/unlike did not verify visibility of the parent post | Comment visibility is checked through the parent post before mutation |
| P1 | Admin last-admin race | Count-then-update allowed two concurrent demotions | Admin mutations are serialized with a transaction-scoped advisory lock and invariant check |
| P1 | Live TRUST_ROOM authorization gap | Host could reference another user's trust room | TRUST_ROOM live creation now requires membership in the referenced room |
| P1 | Battle vote round confusion | Vote accepted an arbitrary round ID unrelated to the selected battle | Vote insert now requires the round to belong to the battle |
| P1 | Go toolchain was pinned to a stale security patch | Go 1.24.3 had multiple later 1.24 security releases | Raised the supported toolchain/image/CI baseline to Go 1.24.13 |
| P1 | Fiber dependency contained known 2026 vulnerabilities | `github.com/gofiber/fiber/v2` was pinned to v2.52.9 | Upgraded to v2.52.14, the current v2 release at audit time |
| P1 | Media S3 false-success | Non-local video processing marked HLS assets ready without transcoding | Unsupported object-store video transcoding now fails deterministically instead of publishing a false READY state |
| P1 | Production API could implicitly run migrations | API startup always executed DDL | `AUTO_MIGRATE` is explicit and rejected in production; migration runs are a release step |
| P1 | Local compose contained hardcoded infrastructure passwords | Dev compose embedded reusable credentials | Compose now requires secret values from environment configuration |
| P1 | HLS child objects were unsigned | Static playlists referenced raw object keys | Protected gateway rewrites relative HLS URIs to short-lived signed gateway URLs |

## Security controls retained

- JWT parser pins HS256 and requires a known `kid`.
- Refresh rotation uses a database compare-and-swap on the current refresh-token hash.
- Production rejects default secrets, non-HTTPS base URLs, wildcard CORS and insecure cookies.
- CSRF uses a server-side session secret + header check; no CSRF cookie is used.
- Critical auth/password rate limits fail closed if Redis is unavailable.
- Uploads validate declared size, checksum, magic-byte MIME and allowlist membership.
- FFmpeg has bounded concurrency, timeouts, cancellation and output-size monitoring.
- WebSocket connections have authentication, membership authorization, bounded queues and message limits.
- Audit events avoid raw authentication material.
