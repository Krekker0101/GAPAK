import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8');

test('normal registration preserves email and explicitly disables anonymous mode', () => {
  const s = read('src/domains/auth/api/authApi.ts');
  assert.match(s, /preferAnonymous: input\.preferAnonymous \?\? false/);
  assert.match(s, /\/auth\/register/);
  assert.doesNotMatch(s, /email:\s*undefined/);
});

test('anonymous registration uses the dedicated backend endpoint', () => {
  const s = read('src/domains/auth/api/authApi.ts');
  assert.match(s, /\/auth\/register-anonymous/);
});

test('login exposes the backend TOTP field instead of a fabricated challenge flow', () => {
  const contracts = read('src/shared/api/backendContracts.ts');
  const context = read('src/domains/auth/AuthContext.tsx');
  assert.match(contracts, /totpCode\?: string/);
  assert.doesNotMatch(context, /challengeId/);
  assert.doesNotMatch(context, /response\.requires2FA/);
});

test('logout-all uses the real logout endpoint and allDevices=true', () => {
  const s = read('src/domains/auth/api/authApi.ts');
  assert.match(s, /\/auth\/logout/);
  assert.match(s, /allDevices: true/);
  assert.doesNotMatch(s, /logout-all/);
});

test('OAuth is redirect based; frontend does not POST the callback as JSON', () => {
  const s = read('src/domains/auth/api/authApi.ts');
  assert.match(s, /oauthRedirect/);
  assert.match(s, /window\.location\.assign/);
  assert.doesNotMatch(s, /oauthCallback/);
});

test('OAuth redirect URL is validated before navigation', () => {
  const s = read('src/domains/auth/api/authApi.ts');
  assert.match(s, /new URL\(response\.url/);
  assert.match(s, /INVALID_OAUTH_REDIRECT/);
});

test('CSRF is bootstrapped before auth mutations and recovered once on CSRF rejection', () => {
  const context = read('src/domains/auth/AuthContext.tsx');
  const client = read('src/shared/api/httpClient.ts');
  assert.match(context, /await authManager\.ensureCsrf\(\)/);
  assert.match(client, /responseStatus === 403/);
  assert.match(client, /\/csrf\/i\.test\(csrfError\.code\)/);
  assert.match(client, /bootstrapCsrf\(\)/);
  assert.match(client, /csrfRetry: true/);
  assert.match(client, /headers\.Authorization = `Bearer \$\{accessToken\}`/);
});

test('2FA management endpoints are CSRF protected', () => {
  const s = read('src/domains/auth/api/authApi.ts');
  assert.match(s, /twoFactorSetup[\s\S]*httpClient\.post/);
  assert.match(s, /twoFactorVerify[\s\S]*httpClient\.post/);
  assert.match(s, /twoFactorDisable[\s\S]*httpClient\.post/);
});

test('refresh uses the real /auth/refresh route and HttpOnly cookie semantics', () => {
  const s = read('src/shared/api/httpClient.ts');
  assert.match(s, /resolveApiUrl\('\/auth\/refresh'\)/);
  assert.match(s, /credentials:\s*'include'/);
  assert.doesNotMatch(s, /refreshToken.*localStorage/);
  assert.doesNotMatch(s, /mockBackend/);
});

test('concurrent refresh calls are single-flight', () => {
  const s = read('src/shared/api/httpClient.ts');
  assert.match(s, /if \(this\.refreshPromise\) return this\.refreshPromise/);
  assert.match(s, /this\.refreshPromise = this\.executeCoordinatedRefreshRequest\(\)/);
  assert.match(s, /navigator\.locks\.request\('gapak-session-refresh'/);
});
