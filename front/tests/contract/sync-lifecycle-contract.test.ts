import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('sync lifecycle is scoped to account identity, not profile renders', () => {
  const source = readFileSync('src/shared/sync/SyncBridge.tsx', 'utf8');
  assert.match(source, /\[queryClient, userId\]/);
  assert.doesNotMatch(source, /\[onNotificationsChanged, queryClient, user\]/);
  assert.match(source, /notificationsCallback\.current/);
  assert.match(source, /controller\.abort\(\)/);
  assert.match(source, /signal: controller\.signal, retryCount: 0/);
  assert.match(source, /Date\.now\(\) < nextAttemptAt/);
  assert.match(source, /Math\.min\(120_000/);
});
