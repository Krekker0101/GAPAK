import test from 'node:test';
import assert from 'node:assert/strict';
import { isLocallyUsableSyncCursor } from '../../src/shared/sync/syncCursor.ts';

const cursor = 'opaque-payload.opaque-signature';

test('accepts a fresh well-formed cursor for server-side signature validation', () => {
  const now = Date.UTC(2026, 8, 7, 12, 0, 0);
  assert.equal(isLocallyUsableSyncCursor(cursor, String(now - 60_000), now), true);
});

test('rejects the expired cursor before making a request that must return 400', () => {
  const now = Date.UTC(2026, 8, 7, 12, 0, 0);
  assert.equal(isLocallyUsableSyncCursor(cursor, String(now - 10 * 24 * 60 * 60 * 1000), now), false);
});

test('rejects legacy, malformed and future-dated cursor records', () => {
  const now = Date.UTC(2026, 8, 7, 12, 0, 0);
  assert.equal(isLocallyUsableSyncCursor(cursor, null, now), false);
  assert.equal(isLocallyUsableSyncCursor('not-a-cursor', String(now), now), false);
  assert.equal(isLocallyUsableSyncCursor(cursor, String(now + 1), now), false);
});
