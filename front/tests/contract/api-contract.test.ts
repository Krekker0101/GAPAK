import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const read=(f:string)=>readFileSync(join(process.cwd(),f),'utf8');

test('critical business APIs remain server-backed', () => {
  const files=['src/domains/auth/api/authApi.ts','src/domains/connections/api/connectionsApi.ts','src/domains/media/api/mediaApi.ts','src/domains/stories/api/storiesApi.ts','src/domains/chats/api/chatsApi.ts','src/domains/notifications/api/notificationsApi.ts','src/domains/security/api/securityApi.ts'];
  for(const f of files){ const s=read(f); assert.doesNotMatch(s,/=>\s*undefined/); assert.doesNotMatch(s,/success:\s*true/); }
});

test('critical APIs do not fabricate server metadata', () => {
  const files=['src/domains/media/api/mediaApi.ts','src/domains/connections/api/connectionsApi.ts','src/domains/stories/api/storiesApi.ts'];
  for(const f of files){ const s=read(f); assert.doesNotMatch(s,/new Date\(\)\.toISOString\(\)|ownerId:\s*''|email:\s*''|trustScore:\s*0/); }
});

test('HTTP error and cancellation contract is explicit', () => {
  const s=read('src/shared/api/httpClient.ts');
  assert.match(s,/ApiError/); assert.match(s,/abort/i); assert.match(s,/TIMEOUT/);
});


test('production transport does not import or execute the development mock backend', () => {
  const source = read('src/shared/api/httpClient.ts');
  assert.equal(source.includes("devtools/mocks/api/mockBackend"), false);
  assert.equal(source.includes("credentials: 'include'"), true);
  assert.equal(source.includes('X-Request-ID'), true);
});
