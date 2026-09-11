import test from 'node:test';
import assert from 'node:assert/strict';
import { createPresenceSaveQueue, readPresencePreference } from '../../src/domains/auth/presencePreference.ts';

test('every selectable presence survives profile hydration', () => {
  for (const presence of ['online', 'away', 'busy', 'invisible']) {
    assert.equal(readPresencePreference(JSON.parse(JSON.stringify({ presence })).presence), presence);
  }
  for (const invalid of ['offline', 'ACTIVE', '', null, undefined, 42]) {
    assert.equal(readPresencePreference(invalid), undefined);
  }
});

test('rapid selections are persisted in selection order, even with a slow first request', async () => {
  const enqueue = createPresenceSaveQueue();
  const writes: string[] = [];
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => { release = resolve; });
  const first = enqueue(async () => { await blocked; writes.push('away'); });
  const second = enqueue(async () => { writes.push('busy'); });
  const last = enqueue(async () => { writes.push('invisible'); });
  await Promise.resolve();
  assert.deepEqual(writes, []);
  release();
  await Promise.all([first, second, last]);
  assert.deepEqual(writes, ['away', 'busy', 'invisible']);
});

test('failed save is reported and does not prevent the next selection from saving', async () => {
  const enqueue = createPresenceSaveQueue();
  await assert.rejects(enqueue(async () => { throw new Error('Service Unavailable'); }), /Service Unavailable/);
  assert.equal(await enqueue(async () => 'online'), 'online');
});
