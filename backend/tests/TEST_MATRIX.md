# GAPAK test matrix

## Authentication

- login success/failure and lockout
- refresh rotation
- refresh replay
- logout and logout-all
- password reset single-use
- password change session invalidation
- 2FA success/failure/replay
- OAuth PKCE/state/verified-email linking

## Chat / realtime

- 100 concurrent sends
- duplicate `client_message_id`
- sequence ordering
- reconnect using `after_sequence`
- offline recovery
- membership/blocked-user authorization
- read/delivery receipts
- slow consumer handling

## Media

- MIME spoofing
- invalid magic bytes
- exact multipart size
- corrupt media
- processing timeout/cancellation
- retry and stale lease
- concurrent playback
- one-time view semantics
- orphan/stuck reconciliation

## Workers

- concurrent claim
- stale lease fencing
- heartbeat
- retry backoff
- retry exhaustion
- crash and reclaim
- Redis unavailable fallback

## Database / Redis

- duplicate unique invariant
- concurrent update
- deadlock-safe transaction paths
- migration checksum/duplicate version detection
- Redis atomic operations and outage behavior
