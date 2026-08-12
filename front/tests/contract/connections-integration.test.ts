import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file: string) => readFileSync(file, 'utf8');
const api = read('src/domains/connections/api/connectionsApi.ts');
const page = read('src/pages/ConnectionsPage.tsx');

const forbidden = [
  '/connections/:connectionId/reject',
  '/connections/:connectionId/cancel',
  '/connections/:connectionId/block',
  '/connections/:connectionId/unblock',
];

test('connections API uses only backend-supported endpoints', () => {
  assert.match(api, /['"]\/connections['"]/);
  assert.match(api, /['"]\/connections\/requests['"]/);
  assert.match(api, /\/connections\/\$\{encodeURIComponent\(connectionId\)\}\/accept/);
  assert.match(api, /\/connections\/\$\{encodeURIComponent\(connectionId\)\}\/trusted-circle/);
  assert.match(api, /\/connections\/\$\{encodeURIComponent\(connectionId\)\}/);
  for (const endpoint of forbidden) assert.equal(api.includes(endpoint), false, endpoint);
});

test('connection request sends targetUserId and not requestId', () => {
  assert.match(api, /\{ targetUserId \} satisfies CreateConnectionRequest/);
  assert.equal(api.includes('requestId'), false);
});

test('connection mutations use connectionId for accept, trusted circle and remove', () => {
  assert.match(api, /accept:\s*\(connectionId/);
  assert.match(api, /trustedCircle:\s*\(/);
  assert.match(api, /remove:\s*\(connectionId/);
});

test('unsupported reject/cancel actions are absent from production connections page', () => {
  assert.equal(page.includes('connectionsApi.reject'), false);
  assert.equal(page.includes('connectionsApi.cancel'), false);
  assert.equal(page.includes('Decline'), false);
  assert.equal(page.includes('Cancel'), false);
});

test('connections page treats backend response as source of truth', () => {
  assert.match(page, /connectionsApi\.list/);
  assert.match(page, /query\.data \?\? \[\]/);
  assert.match(page, /connection\.trustedByCurrent/);
  assert.match(page, /connection\.createdAt/);
});

test('negative backend statuses are not converted into fake success', () => {
  assert.match(page, /PageError/);
  assert.match(api, /httpClient\.(post|put|delete)/);
  assert.equal(api.includes('return true'), false);
  assert.equal(api.includes('success: true'), false);
});
