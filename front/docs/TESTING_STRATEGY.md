# GAPAK Front — Production Testing Strategy

## Objective

Testing must demonstrate correctness, not merely increase test count.

```text
                E2E
             /       \
        Integration
        /           \
      Unit       Contract
```

## Test layers

### Unit
Deterministic tests for token lifecycle, refresh/retry decisions, CSRF/header construction, pagination, queue capacity/error classification, crypto validation, hashing, trust states, realtime deduplication/order and reducers.

Time-dependent code must use injected clocks/randomness rather than sleeps.

### Contract
Protect the frontend/backend boundary for:

- auth register/login/refresh/logout/logout-all;
- OAuth callback;
- connections;
- media;
- stories;
- chat/E2EE envelope;
- notifications;
- security/device operations;
- HTTP error envelopes;
- pagination;
- realtime event envelopes.

Contract tests reject fabricated fields, unsupported methods and undocumented routes.

### Integration
Validate workflows with controlled transports:

- login → refresh → logout;
- media init → upload → complete;
- connection request → accept/reject/cancel/remove;
- story create → view → reply → delete;
- chat enqueue → reconnect → resend/ack;
- device register → verify → revoke.

These tests may use deterministic transport doubles, but never fake production implementations.

### E2E
Against a real backend test environment:

- registration;
- login;
- logout;
- profile;
- feed;
- connections;
- chat;
- media;
- stories;
- security center.

A mandatory release E2E job must fail when its required backend environment is unavailable. Local exploratory E2E may be skipped explicitly.

## Failure matrix

Relevant domains must cover:

- 401, 403, 404, 409, 422, 429, 500;
- timeout;
- offline;
- WebSocket disconnect/reconnect;
- stale session;
- CSRF failure.

## Race conditions

Deterministic races include:

- simultaneous refresh calls;
- reconnect during auth refresh;
- duplicate subscribe/unsubscribe;
- unsubscribe during reconnect;
- duplicate/out-of-order realtime events;
- optimistic mutation followed by refetch;
- queue flush during connectivity change;
- retry after 409/429/500;
- duplicate idempotency key.

Use controlled promises/deferred operations. No arbitrary sleeps.

## Security regression

Verify:

- no plaintext E2EE content on wire;
- no private-key/token/password logging;
- trust policy fails closed;
- revoked/changed/unverified devices cannot receive encrypted sends;
- realtime IDs are server-issued;
- CSRF failures are not retried;
- unsafe mutations are not retried without idempotency;
- production code cannot import development mocks;
- no raw HTML injection sinks.

## Coverage policy

Coverage is a signal, not the release criterion.

Targets after dependencies are installed:

- security/crypto/transport/realtime unit core: **90% statements and branches**;
- release-critical endpoint families: **100% contract coverage**;
- listed critical workflows: **100% integration coverage**;
- release-critical journeys: **100% E2E coverage**;
- global application: **80% statement target**, with exclusions documented.

Never inflate coverage with trivial assertions.

## CI commands

```text
npm run lint
npm run typecheck
npm run test:unit
npm run test:contract
npm run test:integration
npm run test:security
npm run test:performance
npm run test:e2e
npm run build
```

`npm run test:all` is the deterministic pre-build gate. `npm run ci:verify` adds the production build.

## Flake policy

- zero arbitrary sleeps;
- no wall-clock assertions without an injected clock;
- no random assertions;
- no test-order dependency;
- no shared mutable state;
- explicit resource cleanup;
- E2E retries must not hide application failures.

A flaky test is a defect and requires an owner, reason and expiry date before quarantine.

## Test data

Use dedicated backend test accounts and deterministic fixtures. Never use production PII or real secrets. Crypto vectors use fixed public test material only.

## Release gates

Block production release on:

- P0/P1 contract regression;
- failing unit/contract/integration/security tests;
- failing typecheck/lint/build;
- missing mandatory E2E infrastructure;
- security regression;
- performance budget regression;
- unexplained critical-module coverage regression.
