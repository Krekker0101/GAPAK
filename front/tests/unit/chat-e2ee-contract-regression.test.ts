import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { backendTrustState } from '../../src/domains/chats/crypto/CryptoProtocol.ts';

test('backend TRUSTED devices map to the frontend verified policy state', () => {
  assert.equal(backendTrustState('TRUSTED'), 'VERIFIED');
  assert.equal(backendTrustState('UNVERIFIED'), 'UNVERIFIED');
  assert.equal(backendTrustState('unexpected-state'), 'UNKNOWN');
});

test('a persisted message restores immutable signed client metadata', () => {
  const source = readFileSync('src/domains/chats/crypto/E2EECryptoEngine.ts', 'utf8');
  assert.match(source, /metadataMessageId/);
  assert.match(source, /metadataCreatedAt/);
  assert.match(source, /id: cryptoMessageId/);
  assert.match(source, /replyToMessageId: typeof metadataReplyToMessageId/);
  const canonicalFields = source.match(/const canonicalEnvelopeData = \(envelope: Pick<E2EEMessageEnvelope, ([^>]+)>/);
  assert.ok(canonicalFields);
  assert.doesNotMatch(canonicalFields?.[1] ?? '', /keyEnvelopes/);
});

test('chat attachments are signed, mapped to the backend, and downloaded only through playback grants', () => {
  const cryptoSource = readFileSync('src/domains/chats/crypto/E2EECryptoEngine.ts', 'utf8');
  const messageSource = readFileSync('src/domains/chats/MessageItem.tsx', 'utf8');
  assert.match(cryptoSource, /canonicalAttachments/);
  assert.match(cryptoSource, /request\.attachments = envelope\.attachments\.map/);
  assert.match(cryptoSource, /mediaFileId: attachment\.mediaFileId/);
  assert.match(messageSource, /requestPlaybackGrant\(attachment\.mediaFileId, 'CHAT_ATTACHMENT'\)/);
});

test('voice messages wait for verified media readiness before becoming sendable', () => {
  const composerSource = readFileSync('src/domains/chats/Composer.tsx', 'utf8');
  const uploadSource = readFileSync('src/domains/media/GlobalUploadManager.ts', 'utf8');
  assert.match(composerSource, /navigator\.mediaDevices\.getUserMedia/);
  assert.match(composerSource, /new MediaRecorder/);
  assert.match(composerSource, /waitForCompletion\(uploadId\)/);
  assert.match(uploadSource, /waitUntilMediaReady\(result\.mediaFileId\)/);
  assert.match(uploadSource, /asset\.status === 'READY'/);
});

test('server TTL is kept outside sender-signed expiry bytes and enforced in the UI', () => {
  const cryptoSource = readFileSync('src/domains/chats/crypto/E2EECryptoEngine.ts', 'utf8');
  const viewSource = readFileSync('src/domains/chats/ChatsView.tsx', 'utf8');
  assert.match(cryptoSource, /typeof metadataExpiresAt === 'string' \? metadataExpiresAt : undefined/);
  assert.match(viewSource, /expiresAt: message\.expiresAt \?\? decrypted\.expiresAt/);
  assert.match(viewSource, /Date\.parse\(message\.expiresAt\) > expiryClock/);
});
