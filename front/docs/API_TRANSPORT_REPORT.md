# GAPAK API Transport Report — Phase 2

## Status

**Phase implementation: COMPLETE at source level.**

The transport now uses the documented Railway backend contract and does not depend on the development mock backend.

## Implemented

### Central transport
- `src/shared/api/httpClient.ts`
- `src/shared/api/ApiClient.ts`

The transport provides:
- typed request/response generics;
- canonical `/api/v1` URL resolution;
- `credentials: include`;
- memory-only access token;
- HttpOnly-cookie-compatible refresh flow;
- memory-only CSRF token;
- `X-CSRF-Token`;
- `X-Request-ID`;
- `AbortSignal`;
- bounded timeout;
- typed `ApiError`;
- backend error code/message/details;
- server request ID propagation;
- `Retry-After`;
- bounded exponential retry with jitter;
- retries only for safe methods or explicitly idempotent mutations;
- single-flight refresh;
- fail-closed session invalidation after refresh failure;
- strict success-envelope validation;
- 204 handling;
- confirmed logout clears local session state only after a successful backend response.

### Refresh behavior

Concurrent 401 responses share one `refreshPromise`. The refresh credential is never read by JavaScript.

A failed refresh clears:
- access token;
- in-memory CSRF token;
- session state.

The transport does not endlessly retry authentication failures.

### Security

No refresh token is stored in localStorage/sessionStorage.

The transport no longer imports or dynamically loads the development mock backend.

No token is added to URLs.

No sensitive request/response payload is added to telemetry by this transport.

## Tests

### Lint

`npm run lint`

**PASS**

### Unit

`npm run test:unit`

**PASS — 12/12**

Additional transport tests cover:
- typed ApiError fields;
- ApiClient generic boundary;
- canonical API prefix;
- browser credentials;
- request ID;
- single-flight refresh;
- fail-closed session invalidation;
- production mock isolation.

### Contract

`npm run test:contract`

**PASS — 21/21**

### Full existing suite

`npm run test:all`

**PASS — 71/71**

No skipped tests.

## Environment verification blockers

### Typecheck

`npm run typecheck`

**BLOCKED**

The uploaded environment does not contain a complete usable dependency installation. TypeScript reports missing type definition packages including React, React DOM, Node and Babel/ESTree definitions.

An attempted `npm ci --ignore-scripts` could not complete in the available execution environment. Therefore typecheck is not falsely reported as passing.

### Build

`npm run build`

**BLOCKED**

The local `vite` executable is not usable in the current dependency state (`vite: Permission denied`).

This is an environment/dependency-installation blocker, not a production success.

## Backend/live verification

No Railway live request was fabricated or substituted with a mock.

The transport is contract-aligned at source level, but browser-level verification of:
- CORS;
- `SameSite=None; Secure` cookies;
- CSRF cookie/header behavior;
- refresh cookie rotation;
- Vercel origin;
- Railway TLS;
- OAuth redirects

still requires a real deployed staging/production environment.

## Important remaining integration blocker

The backend's `/ws` endpoint is protected by HTTP `Authorization: Bearer` middleware while browser WebSocket construction cannot set arbitrary Authorization headers. This is outside the HTTP transport implementation and must be resolved in the realtime integration phase without placing access tokens in URLs.

## Files changed

- `src/shared/api/httpClient.ts`
- `src/shared/api/ApiClient.ts`
- `src/domains/auth/api/authApi.ts`
- `tests/unit/api-transport.test.ts`
- `tests/contract/api-contract.test.ts`
- `tests/production-boundary.test.ts`

## Conclusion

The HTTP API transport is ready for the next integration phase from a source/contract perspective.

**Do not call the overall frontend production-ready yet:** dependency installation, typecheck/build, and live Vercel ↔ Railway browser verification remain outstanding.
