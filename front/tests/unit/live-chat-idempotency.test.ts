import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// NOTE: src/devtools/live/LiveStreamService.ts transitively imports
// '../../shared/types' (a directory import), which Vite/TS resolve but the
// plain Node ESM loader used by this test runner does not. So this is a
// source-behavior check in the same spirit as tests/unit/websocket-production.test.ts,
// rather than an executed import — see tests/contract for the paired
// structural checks.
const read = (path: string) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('sendChatMessage accepts an idempotency key and dedupes on it before touching rate limiting', async () => {
  const source = await read('src/devtools/live/LiveStreamService.ts');
  const dedupeCheck = source.indexOf('const existing');
  const rateLimitCheck = source.indexOf('lastSentTimestamp.get');
  assert.notEqual(dedupeCheck, -1);
  assert.notEqual(rateLimitCheck, -1);
  assert.ok(dedupeCheck < rateLimitCheck, 'idempotency dedupe must short-circuit before rate-limit/cooldown logic');
  assert.match(source, /existing = \(this\.chatMap\[streamId\] \|\| \[\]\)\.find\(\(m\) => m\.clientMessageId === clientMessageId\)/);
  assert.match(source, /if \(existing\) return \{ success: true, message: existing \}/);
});

test('sent live-chat messages are marked with status "sent" and carry their clientMessageId', async () => {
  const source = await read('src/devtools/live/LiveStreamService.ts');
  assert.match(source, /clientMessageId,\s*\n\s*status: 'sent',/);
});

test('retryChatMessage resends by clientMessageId and reports failure for an unknown one instead of inventing a message', async () => {
  const source = await read('src/devtools/live/LiveStreamService.ts');
  assert.match(source, /public static retryChatMessage\(streamId: string, clientMessageId: string\)/);
  assert.match(source, /if \(!current\) return \{ success: false, error: 'Message no longer available for retry in this session\.' \}/);
});
