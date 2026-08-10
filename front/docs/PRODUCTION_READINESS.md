# GAPAK Front — Production Readiness Audit

Date: 2026-08-09

| Category | Status | Severity | Notes |
|---|---|---|---|
| Architecture | READY | P1 | Production imports no longer depend on legacy mock domain services; dev fixtures are isolated under `src/devtools/`. |
| API | NEEDS WORK | P0 | Real service boundaries exist, but backend contract coverage is incomplete for several product mutations. |
| Auth | BLOCKED | P0 | No production login/register UI route; CSRF bootstrap contract is also backend-dependent. |
| Security | NEEDS WORK | P1 | XSS sinks/fake security removed; backend CSRF/session/authorization remain release dependencies. |
| E2EE | NEEDS WORK | P0 | Real Web Crypto primitives are used, but full E2EE requires backend device/replay/rotation guarantees. |
| Realtime | NEEDS WORK | P0 | Real WebSocket client exists; server replay, ordering, ack and multi-tab strategy remain backend dependencies. |
| Chat | NEEDS WORK | P0 | Real REST/E2EE path exists; attachments and complete receipt/ack semantics depend on backend. |
| Media | NEEDS WORK | P1 | Signed upload/playback flow is real; encrypted attachment pipeline is intentionally blocked. |
| Stories | NEEDS WORK | P1 | Read/view/reaction/reply are API-backed; story creation contract is missing and therefore not simulated. |
| Live | NEEDS WORK | P1 | Stream/playback/chat are API/realtime-backed; server ack semantics for outbound live chat must be verified. |
| Privacy | NEEDS WORK | P1 | Client avoids credential persistence and unsafe URL sinks; backend remains authoritative for visibility and authorization. |
| Routing | READY | P1 | React Router URL routes and lazy loading are in production; unsupported domains render explicit contract states. |
| Performance | READY | P2 | Route splitting, bounded pagination, lazy media and cleanup paths are present; browser profiling still required. |
| Accessibility | READY | P2 | Shared focus/keyboard/reduced-motion primitives exist; final browser QA is still required. |
| Testing | NEEDS WORK | P0 | Static contract tests pass; full typecheck/build and real-browser happy path are blocked by dependency/backend environment. |
| Documentation | READY | P2 | Required architecture/API/auth/realtime/security/E2EE/media/testing/deployment docs now reflect current limitations. |

## P0 fixes completed in this audit

- Removed production-visible local mock domain services by moving Trust Rooms, Battles and Moderation fixtures under `src/devtools/legacy-domains/`.
- Removed fake relationship, post-management and story-creation success paths from production UI.
- Removed fake presence fallbacks that silently returned offline data on backend failure.
- Fixed logout to send the current authenticated session instead of skipping auth headers.
- Fixed realtime listener cleanup and added version-aware stale-event rejection.
- Fixed receipt batching so unsent receipts are retained instead of silently discarded.
- Fixed upload abort-listener cleanup.
- Fixed HLS/player timer/source cleanup.
- Added production-boundary/static security tests and a static lint gate.

## Remaining release blockers

1. Install/build toolchain must be reproducible in CI.
2. Real auth UI must be connected to the existing auth API.
3. Backend CSRF/session contract must be finalized.
4. Backend realtime ordering/replay/ack contract must be verified.
5. Backend E2EE device trust/revocation/replay contract must be verified.
6. Full Playwright happy path must run against a real backend test environment.
