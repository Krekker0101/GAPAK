# GAPAK Backend Threat Model

## Adversaries

| Actor | Capability | Primary goals |
|---|---|---|
| Anonymous attacker | Internet access | enumeration, brute force, resource exhaustion |
| Low-privilege user | Valid account | IDOR, privilege escalation, data disclosure |
| Compromised account | Valid credentials/tokens | persistence, lateral movement |
| Stolen refresh token holder | One refresh token | session takeover |
| Malicious admin | Valid privileged account | unauthorized data or role changes |
| Malicious media uploader | Valid account | parser/ffmpeg/storage exploitation |
| Malicious WebSocket client | Valid account | unauthorized subscriptions/fanout/DoS |
| Distributed attacker | Many IPs/devices | bypass rate limits |
| Compromised API instance | Server-side code execution | secret/data access |
| Redis attacker | Cache/queue access | replay, poisoning, availability |
| Read-only DB attacker | Database reads | token/PII extraction |

## Critical attack surfaces

### Authentication

**Attack:** refresh-token replay.

**Precondition:** attacker obtains an old refresh token.

**Exploit path:** send the old token after legitimate rotation.

**Impact:** session takeover if rotation is not atomic.

**Mitigation:** DB compare-and-swap on the stored token hash; rotation conflict revokes the session.

**Regression test:** concurrent refresh tests plus CAS conflict tests.

### JWT key selection

**Attack:** unknown `kid` fallback.

**Precondition:** attacker can construct a token referencing an untrusted key ID.

**Impact:** verification ambiguity during key rotation.

**Mitigation:** only explicitly configured verification keys are accepted.

**Regression test:** unknown `kid` is rejected.

### OAuth account linking

**Attack:** account takeover through an unverified provider email.

**Precondition:** provider returns an email that is not cryptographically/provider-verified.

**Impact:** attacker could link their social account to an existing local account.

**Mitigation:** only verified provider emails may participate in email-based linking.

**Regression test:** unverified email cannot select an existing account.

### CSRF

**Attack:** cross-site state-changing request.

**Precondition:** browser holds auth cookies.

**Impact:** unauthorized mutation.

**Mitigation:** server-side session CSRF secret + `X-CSRF-Token` header with constant-time comparison; no CSRF cookie is used.

**Regression test:** header-only requests fail.

### Idempotency poisoning

**Attack:** pre-claim another client's idempotency key.

**Precondition:** globally shared key namespace.

**Impact:** victim receives replay/conflict response.

**Mitigation:** key is hashed together with method, path and client address.

### WebSocket authorization

**Attack:** subscribe to another user's chat.

**Precondition:** valid WebSocket connection but no chat membership.

**Impact:** message disclosure.

**Mitigation:** chat access is checked before registering the subscription.

### WebSocket resource exhaustion

**Attack:** oversized messages or too many connections.

**Impact:** memory and connection exhaustion.

**Mitigation:** 1 MiB application message cap, 5 connections per user, bounded outbound queue and idle/read deadlines.

### Media upload

**Attack:** MIME spoofing or oversized part upload.

**Impact:** malicious object stored or resource exhaustion.

**Mitigation:** signed MIME binding, declared size checks, per-part limits and detected MIME validation after composition.

### OAuth provider error leakage

**Attack:** induce provider errors containing sensitive upstream response bodies.

**Impact:** accidental token/error disclosure in logs.

**Mitigation:** provider response bodies are not included in returned error strings.

### Health endpoint disclosure

**Attack:** query readiness endpoint to learn internal dependency errors.

**Impact:** infrastructure fingerprinting.

**Mitigation:** health responses expose only generic dependency-unavailable status; detailed errors remain server-side.

## Security invariants

1. A refresh token can successfully rotate at most once.
2. An unknown JWT `kid` can never verify.
3. A mutation protected by CSRF requires both cookie and header token equality.
4. A WebSocket client cannot subscribe without chat access.
5. A critical auth endpoint cannot silently lose distributed rate limiting in production.
6. An OAuth provider email that is not verified cannot link an existing local account.
7. A signed upload request cannot change its MIME type without invalidating its signature.
8. A password reset token cannot be consumed twice concurrently.
9. Production cannot start with default cryptographic secrets.
10. Raw dependency errors are never returned to WebSocket clients.
