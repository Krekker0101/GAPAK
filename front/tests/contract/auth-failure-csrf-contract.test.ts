import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (file: string) => readFileSync(join(root, file), 'utf8');

test('websocket auth failure expires locally without recursive server logout', () => {
  const provider = read('src/shared/realtime/RealtimeProvider.tsx');
  const manager = read('src/shared/realtime/RealtimeManager.ts');
  assert.match(provider, /onAuthFailure\(\(\) => \{ void expireSession\(\); \}\)/);
  assert.doesNotMatch(provider, /onAuthFailure[\s\S]*logout\(/);
  assert.match(manager, /authFailureNotified/);
  assert.match(manager, /disconnect\('authentication_failed'\)/);
});

test('forced CSRF recovery remains single-flight', () => {
  const manager = read('src/shared/api/authManager.ts');
  const client = read('src/shared/api/httpClient.ts');
  assert.match(manager, /if \(this\.csrfPromise\) return this\.csrfPromise/);
  assert.doesNotMatch(manager, /if \(!force && this\.csrfPromise\)/);
  assert.match(client, /if \(this\.csrfBootstrapPromise\) return this\.csrfBootstrapPromise/);
  assert.match(client, /csrfRetry: true/);
});

test('auth-failure unmount does not send an unauthenticated presence mutation', () => {
  const presence = read('src/domains/platform/PresencePage.tsx');
  assert.match(presence, /if \(authManager\.getAccessToken\(\)\)/);
  assert.match(presence, /presenceApi\.disconnect/);
});
