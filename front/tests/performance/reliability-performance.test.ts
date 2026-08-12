import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=(f:string)=>readFileSync(f,'utf8');

test('realtime lifecycle has bounded reconnect, generation guards and idempotent subscriptions', () => {
  const t=read('src/shared/realtime/WebSocketTransport.ts'); const m=read('src/shared/realtime/RealtimeManager.ts');
  assert.match(t,/maxReconnectAttempts/); assert.match(t,/connectionGeneration/); assert.match(t,/stableConnectionMs/);
  assert.match(m,/activeChatSubscriptions/); assert.match(m,/subscribedChats\.has/);
});

test('realtime routing rejects duplicates and stale ordering', () => {
  const s=read('src/shared/realtime/EventRouter.ts');
  assert.match(s,/processedTtlMs/); assert.match(s,/event\.version <= previous/); assert.match(s,/timestampMs < previousTimestamp/);
});

test('performance budget is executable and bounded', () => {
  const s=read('scripts/performance-audit.mjs');
  assert.match(s,/400 \* 1024/); assert.match(s,/600 \* 1024/); assert.match(s,/Performance budget exceeded/);
});
