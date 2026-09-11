import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('presence writes go to the authenticated backend and only confirmed saves change the UI', () => {
  const auth = readFileSync('src/domains/auth/AuthContext.tsx', 'utf8');
  const api = readFileSync('src/domains/users/api/usersApi.ts', 'utf8');
  const shell = readFileSync('src/app/shell/AppShell.tsx', 'utf8');
  assert.match(api, /patch<BackendProfile>\('\/users\/me\/presence'/);
  assert.match(auth, /await usersApi.updatePresence/);
  assert.match(auth, /readPresencePreference\(user.presence\)/);
  assert.match(auth, /saved.id !== userId/);
  assert.match(auth, /authManager.getSessionId\(\) !== sessionId/);
  assert.match(auth, /PRESENCE_NOT_SAVED/);
  assert.match(shell, /disabled=\{presenceSaving\}/);
  assert.match(shell, /Could not save presence/);
});

test('heartbeats cannot overwrite a manually selected preference', () => {
  const source = readFileSync('src/domains/platform/PresencePage.tsx', 'utf8');
  assert.match(source, /presenceApi.heartbeat/);
  assert.doesNotMatch(source, /setPresenceStatus/);
});
