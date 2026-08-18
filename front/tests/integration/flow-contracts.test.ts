import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const read=(f:string)=>readFileSync(join(process.cwd(),f),'utf8');

test('auth flow has login, refresh, logout and all-devices logout boundary', () => {
  const auth = read('src/domains/auth/api/authApi.ts');
  const manager = read('src/shared/api/authManager.ts');
  assert.match(auth,/login/);
  assert.match(manager,/refresh/);
  assert.match(auth,/logout/);
  assert.match(auth,/allDevices: true/);
  assert.doesNotMatch(auth,/logout-all/);
});

test('media upload flow has init, completion and cancellation boundaries', () => {
  const s=read('src/domains/media/api/mediaApi.ts');
  for(const token of ['/upload-sessions','/complete','/abort']) assert.match(s,new RegExp(token.replace('/','\\/')));
});

test('connection lifecycle reflects the backend: request, accept, trusted-circle and remove; reject/cancel are unsupported', () => {
  const s=read('src/domains/connections/api/connectionsApi.ts');
  for(const token of ['request','accept','trustedCircle','remove']) assert.match(s,new RegExp(`\\b${token}\\b`));
  assert.doesNotMatch(s,/reject|cancel/i);
});

test('story lifecycle reflects create, GET-view, reaction/highlight and delete', () => {
  const s=read('src/domains/stories/api/storiesApi.ts');
  for(const token of ['create','markViewed','react','highlight','delete']) assert.match(s,new RegExp(`\\b${token}\\b`));
  assert.doesNotMatch(s,/\/replies/);
});

test('trusted-device registration consumes the backend direct response shape', () => {
  const s=read('src/domains/chats/api/cryptoApi.ts');
  assert.match(s,/httpClient\.post<BackendTrustedDevice>\(/);
  assert.ok(s.includes('response?.id'));
  assert.doesNotMatch(s,/response\.device\.id/);
});

test('device lifecycle exposes the backend trusted-device register/list/revoke/pre-key boundaries', () => {
  const s=read('src/domains/chats/api/chatsApi.ts')+read('src/domains/chats/api/cryptoApi.ts');
  for(const token of ['registerTrustedDevice','trustedDevices','revokeTrustedDevice','publishPreKey']) assert.match(s,new RegExp(token));
  assert.doesNotMatch(s,/verifyDevice|\/verify/);
});
