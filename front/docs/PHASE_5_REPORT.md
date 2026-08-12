# GAPAK Front — Phase 5 Report

**Phase:** Realtime + Reliability + Performance + Scalability  
**Date:** 2026-08-12  
**Status:** Source-level hardening complete; dependency/runtime verification remains blocked by the supplied environment.

## 1. Executive summary

Phase 5 focused on the realtime lifecycle, retry safety, offline delivery, performance boundaries, accessibility state, and privacy-safe observability.

The existing architecture was preserved. No fake backend behavior was introduced and no production feature was disabled merely to make tests pass.

### Result

- Static lint: **PASS**
- Static/unit-style source tests: **47/47 PASS**
- Performance budget audit against the available production `dist/`: **PASS** after introducing separate application/media-vendor budgets
- Full TypeScript check: **BLOCKED by missing installed dependencies**
- Production build: **BLOCKED because Vite is not installed in the supplied environment**
- Browser E2E: **BLOCKED by the supplied Playwright runtime/environment**

The most important reliability improvements are zombie-socket protection, bounded reconnect behavior, idempotent realtime subscriptions, stale-event rejection, coalesced cache projection, safer retry policy, and non-lossy offline queue behavior.

---

## 2. Realtime audit

### 2.1 Connection lifecycle

The lifecycle is now guarded by a connection generation token.

Every socket callback captures the generation and socket instance. Late `open`, `message`, `error`, or `close` events from an obsolete socket are ignored.

This prevents a common zombie-socket race:

```text
socket A closes
→ reconnect starts
→ socket B opens
→ late socket A event arrives
→ socket A must NOT mutate B's state
```

### 2.2 Authentication

The existing authentication boundary remains mandatory before creating a WebSocket.

Reconnect attempts continue to pass through `ensureAuthenticated()` rather than directly opening a socket with stale session state.

### 2.3 Subscribe / resubscribe

Chat subscriptions are now split into:

- desired subscriptions;
- subscriptions active on the current socket.

Repeated `subscribeToChat(chatId)` calls are idempotent.

On reconnect, active socket state is cleared and only the desired set is replayed once.

This removes duplicate subscription storms caused by repeated component mounts or reconnect races.

### 2.4 Heartbeat

Heartbeat now uses a per-ping nonce.

A pong with an unexpected nonce is ignored as stale and cannot clear the current heartbeat timeout.

Heartbeat timers are explicitly cleaned up on disconnect/dispose.

### 2.5 Reconnect

The existing exponential backoff + jitter was retained and hardened:

- maximum 12 reconnect attempts per unstable connection episode;
- exponential delay capped at 30 seconds;
- random jitter;
- online events no longer reset the retry counter and create an immediate retry storm;
- retry counter resets only after a connection remains stable for 15 seconds.

This prevents repeated connect/open/close cycles from continuously returning to attempt zero.

### 2.6 Event ordering

For events carrying a server version, the router rejects versions older than or equal to the latest accepted version for the stream.

For events without a version, server timestamps are used as a conservative stale-event guard.

This does **not** pretend timestamps are a perfect ordering mechanism. The backend should provide monotonically increasing stream versions for authoritative state events.

### 2.7 Deduplication

Processed event IDs are retained in a bounded `Map`:

- maximum 10,000 IDs;
- 10-minute retention window;
- oldest entries are evicted when the bound is reached.

The implementation no longer relies on an unbounded set.

### 2.8 Backpressure / cache projection

Realtime events are never silently dropped merely to reduce load.

Instead, query invalidation/projection is coalesced by event type + stream/chat key within the same microtask turn.

Example:

```text
100 notification.new events
→ 100 events routed
→ one coalesced notification projection
→ one reconciliation/refetch path
```

This reduces request amplification while preserving event delivery semantics.

### 2.9 Handler isolation

A subscriber throwing an exception can no longer abort the remainder of event routing. Individual handlers are isolated and their failure is captured through sanitized telemetry.

---

## 3. Retry audit

### HTTP

The transport already had the correct basic policy and was tightened with an absolute client retry ceiling of five attempts.

Automatic retry is allowed for:

- GET;
- HEAD;
- OPTIONS;
- mutations carrying an explicit idempotency key.

Unsafe mutations without an idempotency key are not automatically retried.

Backoff remains:

- exponential;
- bounded;
- jittered;
- `Retry-After` aware.

### React Query

Default query retries are now restricted to transient failures:

- network failure;
- timeout;
- 408;
- 429;
- 5xx.

4xx authorization/validation/not-found responses are not retried automatically.

Query retry count is bounded to two attempts with exponential jitter.

Mutations remain non-retrying by default; domain mutations explicitly supply idempotency keys where safe.

---

## 4. Offline behavior

### Message queue

The Phase 3 durable IndexedDB queue was audited and hardened further.

The previous dangerous pattern:

```text
queue full → shift oldest message
```

is absent.

Queue overflow now produces an explicit error. The message is not silently discarded.

Permanent failures are kept in the queue so UI/recovery code can surface them, but they no longer block unrelated later messages from being attempted.

Retryable network/server failures still stop the current flush pass so the queue does not hammer an unavailable backend.

### Conflict resolution

The queue relies on server idempotency using `clientMessageId` and encrypted message envelopes. The frontend does not invent a server-authoritative message state while offline.

Backend requirements remain:

- idempotent `clientMessageId` handling;
- deterministic duplicate acknowledgement;
- authoritative final message state;
- explicit permanent error codes.

### Stale data

TanStack Query remains the server-state authority. Realtime invalidation reconciles cached state after reconnect.

---

## 5. Performance audit

### Critical rendering path

Current route architecture already lazy-loads major authenticated domains. The router was verified to use route-level dynamic imports for feed, profile, connections and domain pages.

The shell and authentication path remain the critical initial path.

### Available bundle evidence

The supplied working directory already contained a production `dist/` artifact, allowing a static bundle audit even though a fresh build could not be executed.

Largest assets observed:

| Asset | Approx. size |
|---|---:|
| `hls-C6LKZaLD.js` | 511 KiB |
| `index-DGOs1Hec.js` | 311 KiB |
| `DomainPages-COXniR6L.js` | 125 KiB |
| `motion-Df7loMxY.js` | 93 KiB |
| CSS bundle | 91 KiB |

Total JS in the available build: approximately **1,233 KiB**.

The HLS vendor bundle is the largest individual asset. It is already isolated from the main application bundle by dynamic import in `VideoPlayer`.

### Budgets added

`scripts/performance-audit.mjs` now enforces:

- application JS chunk ≤ 400 KiB;
- HLS media vendor chunk ≤ 600 KiB.

The current available build passes these budgets.

This intentionally gives the third-party media engine a separate allowance instead of weakening the application bundle budget.

### Media memory

Phase 4 already removed whole-file `File.arrayBuffer()` hashing. The Phase 5 audit confirms incremental SHA-256 remains the production path.

Post media images now use:

- `loading="lazy"`;
- `decoding="async"`.

Post videos use `preload="metadata"` instead of eager full media preload.

### React rendering

The existing feed cache update preserves object identity for unaffected posts. Feed pagination deduplicates posts by server ID.

The largest likely interactive render surfaces remain:

1. `FeedView` / `PostCard` list;
2. `VideoPlayer`;
3. `AppShell` notification/navigation shell;
4. `MessageTimeline`.

The project should avoid blanket memoization. Memoization should be added only after production profiling identifies a hot path.

### Request amplification

Realtime projection coalescing reduces duplicate invalidations. Notification and chat events no longer require one query invalidation per event loop turn.

Feed infinite pagination already uses one cursor per page and deduplicates IDs client-side.

---

## 6. Accessibility audit

Existing design-system work already includes:

- focus-visible styles;
- keyboard dialog trapping;
- Escape handling;
- focus restoration;
- minimum interactive target sizes;
- reduced-motion support.

Phase 5 adds/strengthens:

- loading surfaces expose `role="status"`;
- loading state exposes `aria-busy="true"`;
- error surfaces expose `role="alert"`;
- post media carousel controls have explicit accessible labels;
- lazy media does not remove alternative text.

The modal/dialog focus trap remains intact.

A real screen-reader/browser audit is still required before release because static source inspection cannot prove contrast ratios, announcement timing, or every keyboard traversal path.

---

## 7. Observability

The existing telemetry abstraction was retained rather than introducing a third-party dependency without a backend decision.

### Safe telemetry characteristics

Sensitive fields are redacted by key and common string patterns, including:

- passwords;
- access tokens;
- refresh tokens;
- authorization headers;
- secrets;
- private keys;
- session keys;
- plaintext/message content;
- email;
- phone numbers.

No E2EE plaintext or private cryptographic material is intentionally emitted by the new realtime instrumentation.

### Correlation IDs

HTTP requests continue to generate `X-Request-ID` values and telemetry associates API latency/failure records with that request ID.

### Latency

API request latency is now measured with browser high-resolution timing where available and emitted as a sanitized performance telemetry event.

### Realtime metrics

WebSocket state transitions, reconnect attempts, invalid frames, stale heartbeat pongs, authentication failures, and disconnected sends are observable without logging payload contents.

### Error classification

The transport distinguishes API status failures, timeouts, network errors and authentication failures through `ApiError.code`/status rather than requiring raw response payload logging.

---

## 8. Additional reliability fix found during Phase 5

`PostPage` still contained no-op production callbacks despite the business-domain hardening completed in Phase 4.

Those callbacks were replaced with real post like/comment mutations using idempotency keys and authoritative query invalidation.

This closes a production no-op that was outside the primary realtime scope but visible during the reliability sweep.

---

## 9. Tests added

Added:

`tests/phase5-realtime-performance.test.ts`

Coverage includes:

- zombie socket protection;
- bounded reconnect behavior;
- stable-connection retry reset;
- idempotent subscriptions;
- reconnect resubscription;
- realtime deduplication bounds;
- stale event rejection;
- projection coalescing;
- HTTP retry safety;
- unsafe mutation idempotency requirement;
- offline queue no-silent-drop behavior;
- permanent queue failure isolation;
- lazy image loading;
- metadata-only video preload;
- JS performance budgets;
- accessibility loading/error semantics;
- removal of remaining post-detail no-op actions.

Static suite result:

**47/47 PASS**

---

## 10. Verification results

### PASS

- `npm run lint`
- `npm run test:static`
- `npm run perf:audit` against the available `dist/`

### BLOCKED

#### `npm run typecheck`

The supplied project environment has no installed dependency tree. TypeScript reports missing modules including React, TanStack Query, React Router, Node typings, Vite and related packages.

The remaining non-module diagnostic in `primitives.tsx` is also produced in the same missing-type environment and cannot be treated as a clean project typecheck until dependencies are installed.

#### `npm run build`

Blocked because `vite` is not installed in the supplied environment.

#### `npm run test:e2e`

Blocked by the supplied Playwright runtime/environment; the available executable does not expose the expected `playwright test` command.

These are environment gates, not declared production test passes.

---

## 11. Remaining backend/system requirements

Phase 5 cannot fully prove high-scale realtime behavior without the Railway backend and a real browser environment.

Required backend verification:

1. authoritative realtime sequence numbers;
2. replay cursor semantics;
3. subscription acknowledgements;
4. message acknowledgement/idempotency semantics;
5. server-side duplicate mutation handling;
6. reconnect rate limits;
7. heartbeat timeout semantics;
8. cross-device event ordering;
9. offline conflict resolution;
10. notification unread counter atomicity;
11. media CDN/cache headers;
12. API latency/SLO telemetry;
13. server correlation-ID propagation.

---

## 12. Production recommendations before release

1. Install dependencies with a clean `npm ci` in CI/Vercel.
2. Run a fresh production build and commit the generated bundle-size baseline to CI metrics, not source control.
3. Run Chromium E2E against the real Railway staging backend.
4. Add a realtime soak test with repeated disconnect/reconnect cycles.
5. Add a multi-tab test for duplicate subscriptions and cross-tab logout.
6. Measure memory while scrolling a large media-heavy feed.
7. Run Lighthouse/Web Vitals on real production-like data.
8. Run keyboard-only and screen-reader QA on feed, chat, media and security.
9. Load-test WebSocket reconnect behavior before increasing concurrency limits.

## Final status

**Phase 5 source hardening: COMPLETE.**

**Production verification: NOT YET COMPLETE because dependency installation, fresh build, browser E2E and real backend/load testing are still unavailable in the supplied environment.**

The frontend now has a safer foundation for high-scale realtime operation without introducing fake delivery, unsafe retries, silent offline loss, or sensitive telemetry.
