# GAPAK Front — Security

Date: 2026-08-09

## Implemented frontend controls

- No `dangerouslySetInnerHTML` or direct `innerHTML` sink in production source.
- Mention rendering is plain React text/link rendering.
- External profile URLs are restricted to HTTP(S).
- Access tokens are memory-only.
- Refresh/session credentials are cookie-based and JavaScript-inaccessible by design.
- Telemetry redacts passwords, tokens, authorization headers, email, phone, private keys and message plaintext.
- Permission guards are UX controls only; backend authorization remains authoritative.
- Media playback requires an expiring server grant.
- Panic Mode clears local crypto state and disconnects realtime/uploads after server confirmation.

## CSRF

`credentials: include` is enabled. The frontend can attach an in-memory CSRF token, but the backend must define the bootstrap and rotation contract. SameSite cookies alone must be assessed against the deployment topology.

## XSS / rich text

No HTML rendering is used for user-generated post/chat text. If rich text is introduced later, it requires an allowlisted sanitizer and a documented CSP policy before production use.

## Unsafe URLs

User profile website links are parsed with `URL` and only `http:`/`https:` protocols are allowed.

## Logging / telemetry

No credentials or message plaintext should be sent to telemetry. Production telemetry export is intentionally not implemented in this frontend; the in-memory service is diagnostic only.

## Backend dependencies

- Server-side authorization for every resource and mutation.
- CSRF bootstrap/rotation contract.
- Rate limiting and abuse controls.
- Session rotation/revocation.
- Device-key verification/revocation for E2EE.
- Media authorization and signed URL policy.
