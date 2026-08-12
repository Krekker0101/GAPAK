import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file: string) => fs.readFileSync(file, 'utf8');

test('users API uses only the authoritative user routes', () => {
  const s = read('src/domains/users/api/usersApi.ts');
  for (const route of ['/users/me', '/users/me/privacy', '/users/me/theme', '/users/']) assert.match(s, new RegExp(route.replaceAll('/', '\\/')));
  assert.doesNotMatch(s, /posts-by-user|\/block|\/unblock/);
});

test('security API uses only backend-authoritative session and security routes', () => {
  const s = read('src/domains/security/api/securityApi.ts');
  for (const route of ['/sessions', '/sessions/others', '/security/audit-events', '/security/flags', '/security/alerts', '/security/panic-mode', '/users/me']) assert.match(s, new RegExp(route.replaceAll('/', '\\/')));
  assert.doesNotMatch(s, /markAlertRead|dismissAlert|setFlag|clearPanic|verifyDevice/);
  assert.doesNotMatch(s, /\/security\/devices/);
});

test('security UI does not expose unsupported alert or flag mutations', () => {
  const alerts = read('src/domains/security/components/AlertsSection.tsx');
  const flags = read('src/domains/security/components/SecurityFlagsSection.tsx');
  assert.doesNotMatch(alerts, /markAlertRead|dismissAlert/);
  assert.doesNotMatch(flags, /toggleFlag|setFlag/);
});

test('session management uses DELETE /sessions/others and session id routes', () => {
  const s = read('src/domains/security/api/securityApi.ts');
  assert.match(s, /delete<.*>\('\/sessions\/others'/);
  assert.match(s, /`\/sessions\/\$\{encodeURIComponent\(sessionId\)\}`/);
});
