import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const requiredApiFiles = [
  'src/domains/auth/api/authApi.ts',
  'src/domains/posts/api/postsApi.ts',
  'src/domains/users/api/usersApi.ts',
  'src/domains/connections/api/connectionsApi.ts',
  'src/domains/chats/api/chatsApi.ts',
  'src/domains/notifications/api/notificationsApi.ts',
  'src/domains/media/api/mediaApi.ts',
  'src/domains/stories/api/storiesApi.ts',
  'src/domains/live/api/liveApi.ts',
  'src/domains/security/api/securityApi.ts',
];

test('critical domains have explicit API service boundaries', () => {
  assert.deepEqual(requiredApiFiles.filter((file) => !existsSync(join(process.cwd(), file))), []);
});

test('production HTTP transport always includes browser credentials', () => {
  const http = readFileSync(join(process.cwd(), 'src/shared/api/httpClient.ts'), 'utf8');
  assert.match(http, /credentials:\s*['"]include['"]/);
});

test('frontend maps domain API paths to the backend v1 prefix', () => {
  const env = readFileSync(join(process.cwd(), 'src/shared/config/env.ts'), 'utf8');
  const vite = readFileSync(join(process.cwd(), 'vite.config.ts'), 'utf8');
  assert.match(env, /\/api\/v1/);
  assert.match(vite, /'\/api\/v1'/);
});

test('production WebSocket transport does not use URL tokens', () => {
  const ws = readFileSync(join(process.cwd(), 'src/shared/realtime/WebSocketTransport.ts'), 'utf8');
  assert.doesNotMatch(ws, /[?&](token|access_token|refresh_token)=/i);
  assert.match(ws, /gapak\.realtime\.v1/);
});
