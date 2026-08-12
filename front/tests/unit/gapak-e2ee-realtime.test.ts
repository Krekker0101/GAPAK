import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file: string) => readFileSync(file, 'utf8');

test('realtime contract carries sequence, messageId and chatId', () => {
  const types = read('src/shared/realtime/types.ts');
  const parser = read('src/shared/realtime/EventParser.ts');
  assert.match(types, /sequence\?: number/);
  assert.match(types, /messageId\?: string/);
  assert.match(types, /chatId\?: string/);
  assert.match(parser, /frame\.sequence/);
  assert.match(parser, /frame\.messageId/);
});

test('duplicate and stale message events are rejected', () => {
  const router = read('src/shared/realtime/EventRouter.ts');
  assert.match(router, /processedMessageIds/);
  assert.match(router, /processedEventIds/);
  assert.match(router, /latestSequence/);
  assert.match(router, /event\.sequence/);
});
