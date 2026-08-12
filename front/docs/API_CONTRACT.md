# API Contract

The authoritative frontend/backend contract is `docs/BACKEND_FRONTEND_CONTRACT.md`.

This repository must follow the actual Go/Fiber router and DTOs in the GAPAK backend. Historical endpoint names from earlier frontend docs are not valid contracts.

Key rules:

- REST base: `/api/v1`
- WebSocket route: `/ws`
- browser HTTP: `credentials: include`
- refresh credential: HttpOnly `gapak_rt`
- CSRF header: `X-CSRF-Token`
- success envelope: `{success:true,data,meta}`
- error envelope: `{success:false,error,meta}`
- request correlation: `X-Request-ID` / `meta.requestId`
- no fabricated server state
- no undocumented endpoints
- GAPAK E2EE is a custom protocol, not Signal Protocol

See `docs/BACKEND_FRONTEND_CONTRACT.md` for the complete endpoint matrix and unsupported features.
