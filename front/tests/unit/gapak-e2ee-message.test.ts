import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file: string) => readFileSync(file, 'utf8');

test('encrypted POST uses the flat backend SendMessageRequest shape', () => {
  const api = read('src/domains/chats/api/chatsApi.ts');
  const engine = read('src/domains/chats/crypto/E2EECryptoEngine.ts');
  assert.match(api, /`\/chats\/\$\{encodeURIComponent\(chatId\)\}\/messages`/);
  assert.match(engine, /toBackendSendMessageRequest/);
  assert.match(engine, /encryptionProtocol: 'TRUSTED_CHAT'/);
  assert.match(engine, /keyEnvelopes: Object\.values/);
  const requestBlock = engine.match(/const request: SendMessageRequest = \{([\s\S]*?)\n    \};/);
  assert.ok(requestBlock);
  assert.doesNotMatch(requestBlock?.[1] ?? '', /\bcontent\s*:/);
  assert.doesNotMatch(engine, /return \{[^}]*envelope:/s);
});

test('server acknowledgement is awaited before optimistic message reconciliation', () => {
  const source = read('src/domains/chats/ChatsView.tsx');
  assert.match(source, /await chatsApi\.sendMessage/);
  assert.match(source, /decryptBackendMessage\(acknowledged, activeChat\)/);
});
