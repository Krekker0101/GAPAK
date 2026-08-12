import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file: string) => readFileSync(file, 'utf8');

test('all non-VERIFIED trust states fail closed', () => {
  const source = read('src/domains/chats/crypto/CryptoProtocol.ts');
  for (const state of ['UNVERIFIED', 'CHANGED', 'REVOKED', 'UNKNOWN']) {
    assert.match(source, new RegExp(`'${state}'`));
  }
  assert.match(source, /state === 'VERIFIED'/);
});

test('recipient resolution requires every registered device to be VERIFIED', () => {
  const source = read('src/domains/chats/crypto/E2EECryptoEngine.ts');
  assert.match(source, /devices\.some\(\(device\) => !canEncryptForTrustState/);
  assert.match(source, /No registered encryption devices are available/);
});
