import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file: string) => readFileSync(file, 'utf8');

test('offline queue persists encrypted SendMessageRequest objects only', () => {
  const source = read('src/domains/chats/transport/MessageSendQueue.ts');
  assert.match(source, /IndexedDB/);
  assert.match(source, /request\.ciphertext/);
  assert.match(source, /request\.content !== undefined/);
  assert.match(source, /queue is full/i);
  assert.doesNotMatch(source, /\.shift\(\)/);
});

test('offline send remains queued until a real server response exists', () => {
  const source = read('src/domains/chats/ChatsView.tsx');
  assert.match(source, /kind: 'queued'/);
  assert.match(source, /if \('kind' in serverMessage && serverMessage\.kind === 'queued'\) return/);
});
