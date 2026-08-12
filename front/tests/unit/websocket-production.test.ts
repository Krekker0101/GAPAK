import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path: string) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('backend WebSocket frame schema is represented exactly in the frontend parser', async () => {
  const source = await read('src/shared/realtime/EventParser.ts');
  assert.match(source, /eventId/);
  assert.match(source, /chat\.message\.created/);
  assert.match(source, /chat\.message\.edited/);
  assert.match(source, /chat\.message\.deleted/);
  assert.match(source, /chat\.read_receipt/);
  assert.match(source, /chat\.typing/);
  assert.match(source, /ack/);
  assert.match(source, /read_receipt_ack/);
  assert.match(source, /delivery_ack/);
  assert.match(source, /history/);
  assert.match(source, /sequenceNumber/);
  assert.match(source, /throw new Error/);
});

test('native transport has production lifecycle and reconnect safeguards', async () => {
  const source = await read('src/shared/realtime/WebSocketTransport.ts');
  assert.match(source, /new WebSocket\(env\.wsBaseUrl\)/);
  assert.doesNotMatch(source, /socket\.io|Socket\.IO/i);
  assert.match(source, /maxReconnectAttempts = 12/);
  assert.match(source, /generation/);
  assert.match(source, /this\.socket === socket/);
  assert.match(source, /jitter/);
  assert.match(source, /CONNECTING/);
  assert.match(source, /AUTHENTICATING/);
  assert.match(source, /CONNECTED/);
  assert.match(source, /RECONNECTING/);
  assert.match(source, /CLOSED/);
  assert.doesNotMatch(source, /system\.ping|system\.pong/);
});

test('realtime manager uses backend subscribe/replay contract and prevents duplicate subscriptions', async () => {
  const source = await read('src/shared/realtime/RealtimeManager.ts');
  assert.match(source, /type: 'subscribe'/);
  assert.match(source, /chat_id/);
  assert.match(source, /after_sequence/);
  assert.match(source, /activeChatSubscriptions/);
  assert.match(source, /lastAppliedSequence/);
});

test('offline WebSocket mutations are never silently queued', async () => {
  const source = await read('src/shared/realtime/WebSocketTransport.ts');
  assert.match(source, /event_not_sent_while_disconnected/);
});

test('actual backend event identifiers are used for deduplication and stale ordering', async () => {
  const source = await read('src/shared/realtime/EventRouter.ts');
  assert.match(source, /processedEventIds/);
  assert.match(source, /event\.eventId/);
  assert.match(source, /processedMessageIds/);
  assert.match(source, /latestSequence/);
  assert.match(source, /event\.sequence/);
});
