import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('notifications API uses the documented HTTP contract and does not introduce cursor pagination', async () => {
  const source = await readFile(path.join(root, 'src/domains/notifications/api/notificationsApi.ts'), 'utf8');
  assert.match(source, /\/notifications/);
  assert.match(source, /unread-count/);
  assert.match(source, /\/notifications\/\$\{encodeURIComponent\(id\)\}\/read/);
  assert.match(source, /\/notifications\/read-all/);
  assert.match(source, /limit\?: number/);
  assert.doesNotMatch(source, /cursor/);
  assert.doesNotMatch(source, /offset/);
});

test('notification UI does not fabricate notification IDs or timestamps', async () => {
  const source = await readFile(path.join(root, 'src/domains/notifications/NotificationsController.ts'), 'utf8');
  assert.doesNotMatch(source, /uuid|randomUUID|Date\.now\(\).*read/);
  assert.match(source, /item\.id|id: string/);
});
