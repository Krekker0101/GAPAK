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
  const page = await read('src/domains/live/LivePage.tsx');
  const api = await read('src/domains/live/api/liveApi.ts');
  assert.match(page, /type LiveChatDeliveryStatus = 'pending' \| 'sent' \| 'failed'/);
  assert.match(page, /clientMessageId\?: string/);
  assert.match(page, /deliveryStatus\?: LiveChatDeliveryStatus/);
  assert.match(page, /const clientMessageId = existingClientMessageId \?\? crypto\.randomUUID\(\)/);
  assert.match(page, /liveApi\.postChat\(data\.id, body, clientMessageId\)/);
  assert.match(page, /deliveryStatus: 'failed'/);
  assert.match(api, /idempotencyKey/);
});
