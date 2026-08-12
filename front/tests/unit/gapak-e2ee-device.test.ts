import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file: string) => readFileSync(file, 'utf8');

test('device registration uses backend-issued device IDs', () => {
  const api = read('src/domains/chats/api/cryptoApi.ts');
  assert.match(api, /response\?\.id/);
  assert.doesNotMatch(api, /response\.device\.id/);
  assert.match(api, /bindServerDeviceId/);
  assert.doesNotMatch(api, /deviceId:\s*crypto\.randomUUID\(\)/);
});

test('device private keys are kept in IndexedDB and never sent as private JWK material', () => {
  const store = read('src/shared/security/deviceKeyStore.ts');
  const crypto = read('src/domains/chats/crypto/DeviceCryptoManager.ts');
  assert.match(store, /IndexedDB/);
  assert.match(crypto, /identityPrivateKey/);
  assert.match(crypto, /signingPrivateKey/);
  assert.match(crypto, /agreementPrivateKey/);
  assert.doesNotMatch(read('src/domains/chats/api/cryptoApi.ts'), /PrivateKey|privateKeyJwk|privateJwk/);
});
