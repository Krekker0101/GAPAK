# GAPAK Front — API Contract (compatibility index)

This file is retained for links from earlier stages. The current authoritative API inventory is `docs/API.md`.

Production rules:

- Do not fabricate response data when an endpoint is missing.
- Prefer documented `{ data, meta }` success envelopes and `{ error }` error envelopes.
- Use idempotency keys for safely retryable mutations.
- Use `AbortSignal` for cancellable reads and long-running media operations.
- Backend authorization is authoritative; frontend permission guards are UX only.
- Refresh/session credentials are Secure + HttpOnly and never JavaScript-readable.
