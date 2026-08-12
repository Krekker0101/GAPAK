import test from 'node:test';
import assert from 'node:assert/strict';
import { canEncryptForTrustState, GAPAK_E2EE_PROTOCOL_VERSION } from '../../src/domains/chats/crypto/CryptoProtocol.ts';

test('trust policy is fail-closed', () => {
  assert.equal(GAPAK_E2EE_PROTOCOL_VERSION, 'gapak-e2ee-v1');
  for (const state of ['UNVERIFIED', 'CHANGED', 'REVOKED', 'UNKNOWN'] as const) {
    assert.equal(canEncryptForTrustState(state), false);
  }
  assert.equal(canEncryptForTrustState('VERIFIED'), true);
});

test('protocol source rejects plaintext and requires authenticated message fields', async () => {
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const source = readFileSync(join(process.cwd(), 'src/domains/chats/protocol/messageProtocol.ts'), 'utf8');
  assert.match(source, /Plaintext content is forbidden on the wire/);
  assert.match(source, /senderDeviceId/);
  assert.match(source, /ratchetCounter/);
  assert.match(source, /keyVersion/);
  assert.match(source, /authenticationTag/);
});
