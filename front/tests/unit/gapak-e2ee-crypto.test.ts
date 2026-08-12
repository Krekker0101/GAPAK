import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file: string) => readFileSync(file, 'utf8');

test('GAPAK E2EE implementation uses the explicit GAPAK protocol identifier', () => {
  const source = read('src/domains/chats/crypto/E2EECryptoEngine.ts');
  const protocol = read('src/domains/chats/crypto/CryptoProtocol.ts');
  assert.match(source, /GAPAK E2EE protocol v1/);
  assert.match(protocol, /gapak-e2ee-v1/);
  assert.doesNotMatch(source, /encryptionProtocol\s*:\s*['"]SIGNAL['"]/i);
});

test('GAPAK E2EE cryptographic primitives are explicit', () => {
  const source = read('src/domains/chats/crypto/E2EECryptoEngine.ts');
  assert.match(source, /AES-GCM/);
  assert.match(source, /ECDH/);
  assert.match(source, /P-256/);
  assert.match(source, /HKDF/);
  assert.match(source, /ECDSA.*SHA-256/);
  assert.match(source, /crypto\.getRandomValues/);
});
