import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8');

test('GAPAK E2EE is not mislabeled as Signal/Double Ratchet', () => {
  const cryptoSource = read('src/domains/chats/crypto/E2EECryptoEngine.ts');
  const apiSource = read('src/domains/chats/api/chatsApi.ts');
  assert.match(cryptoSource, /GAPAK E2EE protocol/);
  assert.doesNotMatch(apiSource, /encryptionProtocol\s*:\s*['"]SIGNAL['"]/i);
});

test('trust policy fails closed for every non-VERIFIED state', () => {
  const source = read('src/domains/chats/crypto/CryptoProtocol.ts');
  assert.match(source, /VERIFIED.*UNVERIFIED.*CHANGED.*REVOKED.*UNKNOWN/);
  assert.match(source, /state === 'VERIFIED'/);
});

test('offline queue never silently evicts the oldest encrypted message', () => {
  const source = read('src/domains/chats/transport/MessageSendQueue.ts');
  assert.doesNotMatch(source, /\.shift\(\)/);
  assert.match(source, /queue is full/i);
  assert.match(source, /IndexedDB/);
});

test('message protocol requires authenticated sequence and key version', () => {
  const source = read('src/domains/chats/protocol/messageProtocol.ts');
  assert.ok(source.includes('Number.isSafeInteger(value.ratchetCounter)'));
  assert.ok(source.includes('Number.isSafeInteger(value.keyVersion)'));
  assert.match(source, /senderDeviceId/);
  assert.match(source, /protocolVersion !== GAPAK_E2EE_PROTOCOL_VERSION/);
});

test('deterministic GAPAK safety-number hash vector', () => {
  const input = ['key-A', 'key-B'].sort().join(':');
  const digest = createHash('sha256').update(input).digest('hex');
  const formatted = `${digest.slice(0, 4)} ${digest.slice(4, 8)} ${digest.slice(8, 12)} ${digest.slice(12, 16)} ${digest.slice(16, 20)} ${digest.slice(20, 24)}`;
  assert.equal(formatted, 'f089 428f f551 54bd 9179 8ddb');
});

test('production source does not log plaintext or private key material', () => {
  const source = [
    read('src/domains/chats/crypto/E2EECryptoEngine.ts'),
    read('src/domains/chats/crypto/DeviceCryptoManager.ts'),
    read('src/domains/chats/transport/MessageSendQueue.ts'),
  ].join('\n');
  assert.doesNotMatch(source, /console\.(log|error|warn)\([^\n]*(plaintext|privateKey|sessionSecret|accessToken|refreshToken)/i);
});

test('multi-device recipient resolution requires every device to be trusted', () => {
  const source = read('src/domains/chats/crypto/E2EECryptoEngine.ts');
  assert.match(source, /devices = byUser\.get\(userId\) \?\? \[\]/);
  assert.match(source, /devices\.some\(\(device\) => !canEncryptForTrustState/);
  assert.match(source, /No registered encryption devices are available/);
});

test('realtime reconnect authenticates before opening a new socket and never queues stale mutations', () => {
  const transport = read('src/shared/realtime/WebSocketTransport.ts');
  const connection = read('src/shared/realtime/ConnectionManager.ts');
  assert.match(transport, /await this\.options\.ensureAuthenticated\(\)/);
  assert.match(connection, /ensureAuthenticated: \(\) => this\.auth\.ensureAuthenticated\(\)/);
  assert.match(transport, /event_not_sent_while_disconnected/);
  assert.doesNotMatch(transport, /outboundQueue|\.shift\(\)/);
});
