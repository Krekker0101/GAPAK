import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path: string) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('chat sends use clientMessageId as the HTTP idempotency key', async () => {
  const chatsApi = await read('src/domains/chats/api/chatsApi.ts');
  assert.match(chatsApi, /sendMessage: \(chatId: string, data: SendMessageRequest\) =>/);
  assert.match(chatsApi, /idempotencyKey: data\.clientMessageId/);
});

test('failed chat messages keep their content instead of being cleared', async () => {
  const chatsView = await read('src/domains/chats/ChatsView.tsx');
  assert.match(chatsView, /state: 'failed' as const/);
  // The onError handler must only patch `state`, never touch `content`.
  const onErrorBlock = chatsView.slice(chatsView.indexOf('onError: (_error, variables) => {'), chatsView.indexOf('});', chatsView.indexOf('onError: (_error, variables) => {')));
  assert.doesNotMatch(onErrorBlock, /content:\s*''/);
  assert.doesNotMatch(onErrorBlock, /content:\s*undefined/);
});

test('MessageItem exposes pending/sent/failed-equivalent states with a retry affordance', async () => {
  const messageItem = await read('src/domains/chats/MessageItem.tsx');
  assert.match(messageItem, /case 'sending':/);
  assert.match(messageItem, /case 'sent':/);
  assert.match(messageItem, /case 'failed':/);
  assert.match(messageItem, /onClick={\(\) => onRetry\(message\.id\)}/);
});

test('live-chat messages carry a clientMessageId and a pending/sent/failed status', async () => {
  const types = await read('src/shared/types/live.ts');
  assert.match(types, /export type LiveChatMessageStatus = 'pending' \| 'sent' \| 'failed'/);
  assert.match(types, /clientMessageId\?: string/);
  assert.match(types, /status\?: LiveChatMessageStatus/);

  const service = await read('src/devtools/live/LiveStreamService.ts');
  assert.match(service, /clientMessageId: string = crypto\.randomUUID\(\)/);
  assert.match(service, /find\(\(m\) => m\.clientMessageId === clientMessageId\)/);
  assert.match(service, /retryChatMessage\(streamId: string, clientMessageId: string\)/);

  const liveChat = await read('src/devtools/live/LiveChat.tsx');
  assert.match(liveChat, /crypto\.randomUUID\(\)/);
  assert.match(liveChat, /msg\.status === 'failed'/);
  // Failure must never clear the input the user already typed: the
  // `else if (res.cooldownSec)` branch must not call setInputText('').
  const cooldownBranch = liveChat.slice(liveChat.indexOf('} else if (res.cooldownSec) {'), liveChat.indexOf('};', liveChat.indexOf('} else if (res.cooldownSec) {')));
  assert.notEqual(cooldownBranch.indexOf('} else if (res.cooldownSec) {'), -1);
  assert.doesNotMatch(cooldownBranch, /setInputText\(''\)/);
});
