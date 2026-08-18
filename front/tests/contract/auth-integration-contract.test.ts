import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8');

test('authoritative auth routes are represented without invented endpoints', () => {
  const s = read('src/domains/auth/api/authApi.ts');
  const transport = read('src/shared/api/httpClient.ts');
  for (const route of ['/auth/register', '/auth/register-anonymous', '/auth/login', '/auth/logout', '/auth/2fa/setup', '/auth/2fa/verify', '/auth/2fa/disable']) {
    assert.match(s, new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(transport, /\/auth\/csrf/);
  assert.match(s, /\/auth\/logout/);
  assert.match(transport, /\/auth\/refresh/);
  assert.match(s, /\/auth\/oauth\/\$\{encodeURIComponent\(provider\)\}/);
  assert.doesNotMatch(s, /\/auth\/logout-all/);
  assert.doesNotMatch(s, /oauthCallback/);
});

test('login contract contains all backend-supported request fields', () => {
  const contracts = read('src/shared/api/backendContracts.ts');
  for (const field of ['login', 'password', 'totpCode', 'deviceName', 'deviceFingerprint']) assert.match(contracts, new RegExp(`\\b${field}\\b`));
});

test('OAuth callback is documented as HTTP redirect rather than JSON', () => {
  const docs = read('docs/BACKEND_FRONTEND_CONTRACT.md');
  assert.match(docs, /GET.*\/auth\/callback\/:provider/);
  assert.match(docs, /HTTP redirect; not JSON API/);
});
