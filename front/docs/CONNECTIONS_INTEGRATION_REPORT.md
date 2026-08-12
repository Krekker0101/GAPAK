# GAPAK Connections Integration Report

## Scope

This phase connects the production Connections UI/API layer to the existing GAPAK backend without changing the backend and without inventing unsupported endpoints.

## Authoritative backend contract

- `GET /api/v1/connections`
- `POST /api/v1/connections/requests` body `{ "targetUserId": "<uuid>" }`
- `POST /api/v1/connections/:connectionId/accept`
- `PUT /api/v1/connections/:connectionId/trusted-circle` body `{ "enabled": boolean }`
- `DELETE /api/v1/connections/:connectionId`

The backend returns the standard GAPAK success envelope. The connection list contains server-owned connection records with IDs, requester/addressee IDs, status, accepted timestamp, trusted state, and created/updated timestamps.

## Implemented

- Removed cursor/infinite-query assumptions from Connections. The backend list endpoint returns the complete connection list and does not expose cursor pagination.
- `connectionId` is used for accept, trusted-circle, and remove operations.
- Connection creation sends exactly `targetUserId`.
- Mutating operations use the transport's idempotency header because the backend's idempotency middleware is applied to the connections module.
- Trusted Circle is driven by `trustedByCurrent` from the server response.
- UI no longer fabricates sender/receiver user objects. The connection endpoint supplies IDs, not embedded user profiles.
- Removed production-page calls to unsupported reject and cancel operations.
- Removed the misleading decline/cancel actions instead of simulating success.
- API failures remain transport/API errors and are not converted into fake success.
- Successful mutations invalidate the server-backed connection query so the next state is authoritative.

## Unsupported features intentionally not implemented

The backend does not provide:

- connection reject
- connection cancel
- connection block
- connection unblock

No adapter or fake implementation was added for these operations.

## Important backend semantics

- Accept is only valid for a pending connection where the authenticated user is the addressee.
- Trusted Circle requires an accepted connection and the authenticated user must participate in the connection.
- Remove requires the authenticated user to participate in the connection.
- Invalid/non-existent connection IDs are rejected by the backend rather than being interpreted as local success.
- Backend conflict/authorization/not-found responses remain visible through the normal API error path.

## Tests added

`tests/contract/connections-integration.test.ts` verifies:

1. exact supported endpoints;
2. no reject/cancel/block/unblock endpoints;
3. request payload uses `targetUserId`;
4. mutations use `connectionId`;
5. production UI contains no fake decline/cancel actions;
6. server response is used as the source of truth;
7. API failures are not transformed into fake success.

## Verification status

Static/contract verification is included in the repository test suite.

Live Railway integration still requires authenticated staging credentials and a reachable deployed backend. No backend success was fabricated for this report.
