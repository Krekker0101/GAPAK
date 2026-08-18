import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (file: string) => readFileSync(join(root, file), 'utf8');

test('realtime failure never destroys an otherwise valid HTTP session', () => {
  const provider = read('src/shared/realtime/RealtimeProvider.tsx');
  const context = read('src/domains/auth/AuthContext.tsx');
  const manager = read('src/shared/realtime/RealtimeManager.ts');
  assert.doesNotMatch(provider, /onAuthFailure/);
  assert.doesNotMatch(context, /expireSession/);
  assert.match(manager, /authFailureNotified/);
  assert.match(manager, /disconnect\('authentication_failed'\)/);
});

test('only an unauthorized response can invalidate session restoration', () => {
  const context = read('src/domains/auth/AuthContext.tsx');
  assert.match(context, /err\.status === 401/);
  assert.doesNotMatch(context, /err\.status !== 401 && err\.status !== 403/);
  assert.match(context, /setState\('AUTH_ERROR'\)/);
});

test('browser websocket has a TLS first-frame fallback when cross-site cookies are blocked', () => {
  const auth = read('src/shared/realtime/RealtimeAuthentication.ts');
  const transport = read('src/shared/realtime/WebSocketTransport.ts');
  assert.match(auth, /type: 'auth'/);
  assert.match(auth, /browser_session: true/);
  assert.match(transport, /socket\.send\(JSON\.stringify\(authenticationFrame\)\)/);
  assert.doesNotMatch(transport, /access_token=/);
});

test('successful HTTP refresh reconnects realtime without logging the user out', () => {
  const client = read('src/shared/api/httpClient.ts');
  const provider = read('src/shared/realtime/RealtimeProvider.tsx');
  assert.match(client, /gapak:session-refreshed/);
  assert.match(provider, /addEventListener\('gapak:session-refreshed'/);
  assert.match(provider, /realtimeManager\.connect\(\)/);
});

test('refresh rotation is serialized across browser tabs without persisting credentials', () => {
  const client = read('src/shared/api/httpClient.ts');
  assert.match(client, /navigator\.locks\.request\('gapak-session-refresh'/);
  assert.doesNotMatch(client, /localStorage.*(?:access|refresh).*token/i);
});

test('production session cookies use a non-cacheable same-origin API reverse proxy', () => {
  const vercel = JSON.parse(read('vercel.json')) as { rewrites?: Array<{ source: string; destination: string }>; headers?: Array<{ source: string; headers: Array<{ key: string; value: string }> }> };
  const runtimeEnv = read('src/shared/config/env.ts');
  assert.equal(vercel.rewrites?.[0]?.source, '/api/v1/:path*');
  assert.match(vercel.rewrites?.[0]?.destination ?? '', /^https:\/\/gapak-api-production\.up\.railway\.app\/api\/v1/);
  const apiHeaders = vercel.headers?.find((entry) => entry.source === '/api/v1/:path*')?.headers ?? [];
  assert.ok(apiHeaders.some((header) => header.key.toLowerCase() === 'cache-control' && /no-store/.test(header.value)));
  assert.match(runtimeEnv, /import\.meta\.env\.PROD && !useDirectProductionApi \? '' : configuredApiBaseUrl/);
});

test('forced CSRF recovery remains single-flight', () => {
  const manager = read('src/shared/api/authManager.ts');
  const client = read('src/shared/api/httpClient.ts');
  assert.match(manager, /if \(this\.csrfPromise\) return this\.csrfPromise/);
  assert.doesNotMatch(manager, /if \(!force && this\.csrfPromise\)/);
  assert.match(client, /if \(this\.csrfBootstrapPromise\) return this\.csrfBootstrapPromise/);
  assert.match(client, /csrfRetry: true/);
});

test('session teardown does not send an unauthenticated presence mutation', () => {
  const presence = read('src/domains/platform/PresencePage.tsx');
  assert.match(presence, /if \(authManager\.getAccessToken\(\)\)/);
  assert.match(presence, /presenceApi\.disconnect/);
});
