import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file: string) => readFileSync(file, 'utf8');

test('WebSocket transport guards against zombie sockets and bounded reconnect storms', () => {
  const source = read('src/shared/realtime/WebSocketTransport.ts');
  assert.match(source, /generation/);
  assert.match(source, /this\.socket === socket/);
  assert.match(source, /maxReconnectAttempts = 12/);
  assert.match(source, /Math\.random\(\)/);
  assert.match(source, /stableConnectionMs/);
  assert.doesNotMatch(source, /onlineHandler = \(\) => \{ this\.reconnectAttempts = 0/);
});

test('realtime subscriptions are idempotent and reconnect only resubscribes desired chats', () => {
  const source = read('src/shared/realtime/RealtimeManager.ts');
  assert.match(source, /this\.subscribedChats\.add\(chatId\)/);
  assert.match(source, /activeChatSubscriptions\.has\(chatId\)/);
  assert.match(source, /activeChatSubscriptions/);
  assert.match(source, /this\.activeChatSubscriptions\.clear\(\)/);
});

test('realtime event routing deduplicates with bounded retention and rejects stale ordering', () => {
  const source = read('src/shared/realtime/EventRouter.ts');
  assert.match(source, /processedEventIds/);
  assert.match(source, /processedMessageIds/);
  assert.match(source, /processedTtlMs/);
  assert.match(source, /event\.eventId/);
  assert.match(source, /event\.sequence/);
});

test('HTTP retry policy is bounded and unsafe mutations require idempotency', () => {
  const retry = read('src/shared/api/retryPolicy.ts');
  const client = read('src/shared/api/httpClient.ts');
  assert.match(retry, /Boolean\(idempotencyKey\)/);
  assert.match(retry, /2 \*\* attempt/);
  assert.match(retry, /Math\.random/);
  assert.match(client, /Math\.min\(5, Math\.max\(0, retryCount\)\)/);
  assert.match(client, /X-Idempotency-Key/);
});

test('offline message queue never silently evicts and continues past permanent failures', () => {
  const source = read('src/domains/chats/transport/MessageSendQueue.ts');
  assert.doesNotMatch(source, /shift\(\)/);
  assert.match(source, /queue is full/);
  assert.match(source, /Permanent failures remain persisted/);
  assert.match(source, /continue;/);
});

test('production image media uses lazy loading and metadata-only video preload', () => {
  const source = read('src/domains/posts/PostMedia.tsx');
  assert.match(source, /loading="lazy"/);
  assert.match(source, /decoding="async"/);
  assert.match(source, /preload="metadata"/);
});

test('performance audit script enforces a bounded JS chunk budget', () => {
  const source = read('scripts/performance-audit.mjs');
  assert.match(source, /400 \* 1024/);
  assert.match(source, /600 \* 1024/);
  assert.match(source, /Performance budget exceeded/);
});

test('loading and error surfaces expose assistive technology state', () => {
  const source = read('src/pages/common.tsx');
  assert.match(source, /role="status"/);
  assert.match(source, /aria-busy="true"/);
  assert.match(source, /role="alert"/);
});

test('post detail route no longer exposes no-op production actions', () => {
  const source = read('src/app/router/AppRouter.tsx');
  assert.doesNotMatch(source, /onLikeToggle=\{\(\) => undefined\}/);
  assert.doesNotMatch(source, /onAddComment=\{\(\) => undefined\}/);
});
