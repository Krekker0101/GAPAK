import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path: string) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('RealtimeManager resync uses a formal cursor store and the documented subscribe/after_sequence shape', async () => {
  const manager = await read('src/shared/realtime/RealtimeManager.ts');
  assert.match(manager, /import \{ RealtimeCursorStore \} from '\.\/CursorStore'/);
  assert.match(manager, /lastAppliedSequence = new RealtimeCursorStore\(\)/);
  assert.match(manager, /getCursor\(chatId: string\)/, 'the cursor must be introspectable, not just an internal implementation detail');
  assert.match(manager, /const afterSequence = this\.lastAppliedSequence\.get\(chatId\)/);
  assert.match(manager, /data\.after_sequence = afterSequence/);
  assert.match(manager, /type: 'subscribe'/);
  assert.match(manager, /this\.subscribedChats\.forEach\(\(chatId\) => \{\s*this\.sendChatSubscription\(chatId\);/);
});

test('CursorStore never regresses and exposes the API RealtimeManager depends on', async () => {
  const source = await read('src/shared/realtime/CursorStore.ts');
  assert.match(source, /class RealtimeCursorStore/);
  assert.match(source, /advance\(channelId: string, sequence: number\)/);
  assert.match(source, /if \(current === undefined \|\| sequence > current\)/);
  assert.match(source, /get\(channelId: string\): number \| undefined/);
  assert.match(source, /clear\(\): void/);
});

test('docs/REALTIME.md documents the cursor model and splits client vs backend guarantees', async () => {
  const docs = await read('docs/REALTIME.md');
  assert.match(docs, /## Cursor \/ resync model \(chats\)/);
  assert.match(docs, /after_sequence/);
  assert.match(docs, /### What the client guarantees/);
  assert.match(docs, /### What the backend must guarantee/);
  assert.match(docs, /no gaps/);
});

test('docs/REALTIME.md contains an explicit TODO for the live-chat resync endpoint instead of a fake guarantee', async () => {
  const docs = await read('docs/REALTIME.md');
  assert.match(docs, /TODO — live chat/);
  assert.match(docs, /src\/devtools\/live\/LiveStreamService\.ts/);
  assert.match(docs, /does \*\*not\*\* fake a resync/);
});
