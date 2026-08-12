import test from 'node:test';
import assert from 'node:assert/strict';
import { createOptimisticAllReadState, createOptimisticReadState, isNotificationRead, mergeNotifications } from '../../src/domains/notifications/notificationsState.ts';

const item = (id: string, createdAt: string, readAt: string | null = null) => ({ id, type: 'system', title: id, createdAt, readAt });

test('notifications merge deduplicates by server notification id and preserves newest ordering', () => {
  const result = mergeNotifications(
    { notifications: [item('a', '2026-08-12T10:00:00Z'), item('b', '2026-08-12T09:00:00Z')], hasMore: true },
    { notifications: [item('b', '2026-08-12T09:00:00Z'), item('c', '2026-08-12T11:00:00Z')], hasMore: false },
  );
  assert.deepEqual(result.notifications.map((n) => n.id), ['c', 'a', 'b']);
  assert.equal(result.hasMore, false);
});

test('optimistic mark read does not fabricate a timestamp', () => {
  const state = { items: [item('a', '2026-08-12T10:00:00Z')], hasMore: false, optimisticReadIds: new Set<string>() };
  const next = createOptimisticReadState(state, 'a');
  assert.equal(next.items[0].readAt, null);
  assert.equal(isNotificationRead(next, next.items[0]), true);
});

test('optimistic mark all read affects only local read state', () => {
  const state = { items: [item('a', '2026-08-12T10:00:00Z'), item('b', '2026-08-12T09:00:00Z')], hasMore: false, optimisticReadIds: new Set<string>() };
  const next = createOptimisticAllReadState(state);
  assert.deepEqual([...next.optimisticReadIds], ['a', 'b']);
  assert.equal(next.items[0].readAt, null);
  assert.equal(next.items[1].readAt, null);
});
