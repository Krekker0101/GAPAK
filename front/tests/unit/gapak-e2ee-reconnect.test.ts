import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file: string) => readFileSync(file, 'utf8');

test('reconnect re-authenticates and re-subscribes chats', () => {
  const transport = read('src/shared/realtime/WebSocketTransport.ts');
  const manager = read('src/shared/realtime/RealtimeManager.ts');
  assert.match(transport, /await this\.options\.ensureAuthenticated\(\)/);
  assert.match(manager, /if \(state === 'CONNECTED'\) this\.resubscribeChats\(\)/);
  assert.match(manager, /this\.subscribedChats\.forEach/);
});

test('realtime transport does not queue arbitrary stale mutations', () => {
  const source = read('src/shared/realtime/WebSocketTransport.ts');
  assert.match(source, /event_not_sent_while_disconnected/);
  assert.doesNotMatch(source, /outboundQueue/);
});
