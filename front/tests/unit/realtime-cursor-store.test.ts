import test from 'node:test';
import assert from 'node:assert/strict';
import { RealtimeCursorStore } from '../../src/shared/realtime/CursorStore.ts';

test('cursor is undefined until a sequence is applied', () => {
  const store = new RealtimeCursorStore();
  assert.equal(store.get('chat-1'), undefined);
  assert.equal(store.has('chat-1'), false);
});

test('advance records the highest sequence seen for a channel', () => {
  const store = new RealtimeCursorStore();
  store.advance('chat-1', 5);
  assert.equal(store.get('chat-1'), 5);
  store.advance('chat-1', 9);
  assert.equal(store.get('chat-1'), 9);
});

test('advance never moves the cursor backwards or sideways', () => {
  const store = new RealtimeCursorStore();
  store.advance('chat-1', 10);
  store.advance('chat-1', 3);
  assert.equal(store.get('chat-1'), 10, 'a lower sequence must not regress the cursor');
  store.advance('chat-1', 10);
  assert.equal(store.get('chat-1'), 10, 'an equal sequence must not change the cursor');
});

test('advance ignores non-integer / unsafe sequences', () => {
  const store = new RealtimeCursorStore();
  store.advance('chat-1', Number.NaN);
  store.advance('chat-1', 1.5);
  store.advance('chat-1', Number.POSITIVE_INFINITY);
  assert.equal(store.get('chat-1'), undefined);
});

test('cursors are tracked independently per channel', () => {
  const store = new RealtimeCursorStore();
  store.advance('chat-1', 4);
  store.advance('chat-2', 1);
  assert.equal(store.get('chat-1'), 4);
  assert.equal(store.get('chat-2'), 1);
});

test('clearChannel drops a single channel only', () => {
  const store = new RealtimeCursorStore();
  store.advance('chat-1', 4);
  store.advance('chat-2', 1);
  store.clearChannel('chat-1');
  assert.equal(store.has('chat-1'), false);
  assert.equal(store.get('chat-2'), 1);
});

test('clear drops every stored cursor', () => {
  const store = new RealtimeCursorStore();
  store.advance('chat-1', 4);
  store.advance('chat-2', 1);
  store.clear();
  assert.equal(store.has('chat-1'), false);
  assert.equal(store.has('chat-2'), false);
});

test('snapshot is a read-only copy, not a live view', () => {
  const store = new RealtimeCursorStore();
  store.advance('chat-1', 4);
  const snap = store.snapshot();
  assert.equal(snap.get('chat-1'), 4);
  store.advance('chat-1', 7);
  assert.equal(snap.get('chat-1'), 4, 'snapshot must not change after later mutations');
  assert.equal(store.get('chat-1'), 7);
});
