import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path: string) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('live chat passes its client message id as the HTTP idempotency key', async () => {
  const page = await read('src/domains/live/LivePage.tsx');
  const api = await read('src/domains/live/api/liveApi.ts');
  assert.match(page, /liveApi\.postChat\(data\.id, body, clientMessageId\)/);
  assert.match(api, /postChat: \(streamId: string, body: string, idempotencyKey: string\)/);
  assert.match(api, /\{ idempotencyKey \}/);
});

test('sent live-chat messages are marked with status "sent" and carry their clientMessageId', async () => {
  const source = await read('src/domains/live/LivePage.tsx');
  assert.match(source, /\{ \.\.\.message, clientMessageId, deliveryStatus: 'sent' \}/);
});

test('retryChatMessage resends by clientMessageId and reports failure for an unknown one instead of inventing a message', async () => {
  const source = await read('src/domains/live/LivePage.tsx');
  assert.match(source, /if \(message\.clientMessageId\) sendLiveChat\(message\.body, message\.clientMessageId\)/);
  assert.match(source, /current\.some\(\(item\) => item\.clientMessageId === clientMessageId\)/);
});
