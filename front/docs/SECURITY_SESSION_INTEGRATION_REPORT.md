# GAPAK — Users / Sessions / Security Integration Report

## Scope

This phase connected the frontend to the authoritative GAPAK backend contract for:

- Users
- Sessions
- Security audit events
- Security flags
- Security alerts
- Panic mode
- Existing 2FA state and mutations
- Trusted devices via the backend's chat/trusted-device namespace

Backend was not modified.

## Backend routes used

### Users

- `GET /api/v1/users/me`
- `GET /api/v1/users/:userId`
- `PATCH /api/v1/users/me`
- `PATCH /api/v1/users/me/privacy`
- `PATCH /api/v1/users/me/theme`

### Sessions

- `GET /api/v1/sessions`
- `DELETE /api/v1/sessions/others`
- `DELETE /api/v1/sessions/:sessionId`

### Security

- `GET /api/v1/security/audit-events`
- `GET /api/v1/security/flags`
- `GET /api/v1/security/alerts`
- `POST /api/v1/security/panic-mode`

### Trusted devices

Device lifecycle remains under the already-established backend contract:

- `GET /api/v1/chats/trusted-devices`
- `DELETE /api/v1/chats/trusted-devices/:deviceId`

No `/security/devices` or device-verification endpoint was introduced.

## Changes made

### Users

- Removed the obsolete frontend user-posts API method because the backend has no `/users/:userId/posts` route.
- Removed frontend block/unblock methods because the backend contract does not provide those endpoints.
- Kept only server-backed user read/update operations.
- Reworked the profile page so it does not request a nonexistent user-posts endpoint or fabricate relationship/count/post state.
- Profile editing now uses the backend `/users/me` mutation boundary.
- Public profile display is based only on `BackendPublicProfile` fields.
- Privacy display is based only on backend privacy fields.

### Sessions

- Session UI now consumes `BackendSession` directly.
- Removed fabricated browser/device/location/trust-score fields.
- Current session state comes from `isCurrent`.
- Device/user-agent/IP/location values are rendered only when supplied by the backend.
- `DELETE /sessions/others` is the only implementation of "revoke all other sessions".
- Individual revocation uses `DELETE /sessions/:sessionId`.
- Mutation errors are surfaced to the user instead of silently succeeding.

### Security audit events

- UI now consumes the backend `AuditEvent` shape.
- Removed fabricated `type`, `device`, `ip`, `location`, and timestamp mappings.
- Search/filter operates on backend action/resource/severity fields.
- Metadata is displayed exactly as returned by the backend.

### Security flags

- Flags are now read-only because the backend exposes only `GET /security/flags`.
- Removed fake toggle mutations.
- Removed hardcoded security policy values.

### Security alerts

- UI now consumes the backend `DeviceAlert` shape.
- Removed fake title/description/read/dismiss state.
- Removed unsupported mark-read and dismiss actions.
- Alert timestamps/status/channel/session ID come from the backend.

### Panic mode

- Uses `POST /security/panic-mode` with the backend request shape.
- Uses the current backend session ID when available.
- Displays only backend-returned execution counts and `auditEventId`.
- Removed fabricated execution timestamps.
- Removed the unsupported local "clear/reset panic" operation.
- Local cleanup after an accepted panic operation remains client-side cleanup only; it is not presented as backend state.

### 2FA

- Kept the real backend endpoints from the authentication phase.
- Removed fabricated setup IDs, backup-code counts, verification timestamps, and QR data assumptions.
- Setup consumes `{ secret, otpAuthUrl }` from the backend contract.
- Verification uses the real `{ code }` request.
- Enable/disable state is reconciled from the authenticated server state.

## Explicitly NOT implemented

The following backend capabilities do not exist and therefore were not fabricated:

- connection reject/cancel/block/unblock (handled by later domain phase)
- user block/unblock
- user-specific posts endpoint
- security alert read mutation
- security alert dismiss mutation
- security flag mutation
- panic reset/clear endpoint
- security-device verification endpoint

## Tests added

`tests/contract/security-session-user-contract.test.ts`

Coverage includes:

- authoritative user routes
- absence of user-posts/block/unblock endpoints
- authoritative session routes
- `DELETE /sessions/others`
- security audit/flags/alerts/panic routes
- absence of unsupported security mutations

An existing stale Phase 4 contract assertion was also updated so it no longer requires the removed `UnsupportedUserContractError` implementation.

## Verification

### Passed

- Static lint: **PASS**
- Unit tests: **22/22 PASS**
- Contract tests: **28/28 PASS**
- Full existing test suite: **88/88 PASS**

### Blocked

`npm run typecheck` cannot currently be treated as a repository pass because the execution environment does not have the project's installed dependency/type packages. The compiler reports missing modules such as React, Playwright, Node types, Vite and related packages.

This is an environment/dependency installation blocker, not a backend contract success claim.

### Not verified

No live Railway session/security verification was claimed. Browser-level verification still requires the deployed Railway backend and correctly configured Vercel origin/cookies/CSRF.

## Remaining risks / assumptions

1. The repository's checked-in backend contract does not include the exact PATCH DTO definitions for `/users/me` and `/users/me/privacy`. The frontend now constrains these requests to fields already present in the authoritative profile/privacy DTOs, but the exact writable-field set should be confirmed against the backend controller DTO before production release.
2. Existing unrelated repository type errors remain hidden behind the missing dependency installation; a clean `npm ci` followed by typecheck is required before release.
3. WebSocket authentication remains a separate integration blocker documented in the previous transport phase.

## Phase verdict

**PHASE COMPLETE — contract integration verified statically; live backend verification and clean dependency-backed typecheck remain outstanding.**
