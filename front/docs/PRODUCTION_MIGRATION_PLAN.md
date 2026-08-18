# GAPAK Front — Production Migration / Final Audit

This document is retained for historical continuity. The final production-readiness state is documented in `docs/PRODUCTION_READINESS.md`.

## Final migration rules

- Production contains no runtime mock transport or fixture domain.
- Unsupported backend functionality is represented by an explicit contract/permission state.
- Fake crypto, fake OAuth, fake 2FA, fake realtime and fake media are not production paths.
- Backend authorization is authoritative.

## Completed final-stage corrections

- Legacy Trust Rooms, Battles and Moderation fixtures were removed; their production pages now use backend controllers.
- Production relationship/post/story UI no longer claims unsupported mutations succeeded.
- Presence no longer fabricates `offline` responses after backend failures.
- Logout uses the authenticated transport.
- Realtime event deduplication now also rejects stale versioned events.
- Realtime subscriptions and provider lifecycle clean up correctly.
- Receipt batching retains unsent receipts.
- Media upload abort listeners and video/HLS cleanup were hardened.
- Static production-boundary/security tests and a project lint gate were added.

## Remaining backend dependencies

- production auth UI + backend session/CSRF contract;
- complete realtime replay/order/ack contract;
- complete E2EE device trust/revocation/replay contract;
- encrypted chat attachment protocol;
- missing story creation endpoint contract;
- relationship mutation endpoints for follow/Trusted Circle/mute/block;
- moderation/report mutation endpoints;
- real browser E2E against a backend environment.
