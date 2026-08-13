import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isPersistedSessionExpired,
  offsetFromCompletedParts,
  progressPercent,
  quickMatchesFile,
  reconcileSelectedFile,
} from '../../src/domains/media/uploadReconciliation.ts';
import type { PersistedUploadSession } from '../../src/domains/media/UploadSessionStore.ts';

const NOW = Date.parse('2026-08-12T12:00:00.000Z');

const baseSession = (overrides: Partial<PersistedUploadSession> = {}): PersistedUploadSession => ({
  id: 'session-1',
  uploadId: 'upload-1',
  fileName: 'vacation.mp4',
  fileSize: 20_000_000,
  mimeType: 'video/mp4',
  context: 'CHAT_ATTACHMENT',
  contentHash: 'deadbeef'.repeat(8),
  chunkSizeBytes: 8_000_000,
  totalParts: 3,
  completedParts: [
    { partNumber: 1, etag: 'etag-1' },
    { partNumber: 2, etag: 'etag-2' },
  ],
  offsetBytes: 16_000_000,
  expiresAt: new Date(NOW + 60 * 60 * 1000).toISOString(),
  createdAt: new Date(NOW - 60 * 1000).toISOString(),
  updatedAt: new Date(NOW - 1000).toISOString(),
  ...overrides,
});

test('successful resume: matching name/size/hash and unexpired session is RESUMABLE', () => {
  const session = baseSession();
  const outcome = reconcileSelectedFile(session, { name: 'vacation.mp4', size: 20_000_000 }, session.contentHash, NOW);
  assert.deepEqual(outcome, { kind: 'RESUMABLE' });
});

test('expired session: TTL passed is reported as EXPIRED even if the file matches perfectly', () => {
  const session = baseSession({ expiresAt: new Date(NOW - 1000).toISOString() });
  const outcome = reconcileSelectedFile(session, { name: 'vacation.mp4', size: 20_000_000 }, session.contentHash, NOW);
  assert.deepEqual(outcome, { kind: 'EXPIRED' });
});

test('expired session: exactly at the expiry boundary is treated as expired (fail-closed)', () => {
  const session = baseSession({ expiresAt: new Date(NOW).toISOString() });
  const outcome = reconcileSelectedFile(session, { name: 'vacation.mp4', size: 20_000_000 }, session.contentHash, NOW);
  assert.deepEqual(outcome, { kind: 'EXPIRED' });
});

test('malformed expiresAt is treated as expired rather than resumable', () => {
  const session = baseSession({ expiresAt: 'not-a-date' });
  assert.equal(isPersistedSessionExpired(session, NOW), true);
});

test('hash mismatch: same name/size but different file content is HASH_MISMATCH, not silently resumed', () => {
  const session = baseSession();
  const outcome = reconcileSelectedFile(session, { name: 'vacation.mp4', size: 20_000_000 }, 'a-completely-different-hash', NOW);
  assert.deepEqual(outcome, { kind: 'HASH_MISMATCH' });
});

test('file mismatch: different size is rejected before even considering the hash', () => {
  const session = baseSession();
  const outcome = reconcileSelectedFile(session, { name: 'vacation.mp4', size: 999 }, session.contentHash, NOW);
  assert.deepEqual(outcome, { kind: 'FILE_MISMATCH' });
});

test('file mismatch: different name is rejected', () => {
  const session = baseSession();
  const outcome = reconcileSelectedFile(session, { name: 'other.mp4', size: 20_000_000 }, session.contentHash, NOW);
  assert.deepEqual(outcome, { kind: 'FILE_MISMATCH' });
});

test('no persisted session at all is NOT_FOUND', () => {
  const outcome = reconcileSelectedFile(undefined, { name: 'vacation.mp4', size: 20_000_000 }, 'anything', NOW);
  assert.deepEqual(outcome, { kind: 'NOT_FOUND' });
});

test('quickMatchesFile only checks name and size, not hash', () => {
  const session = baseSession();
  assert.equal(quickMatchesFile(session, { name: 'vacation.mp4', size: 20_000_000 }), true);
  assert.equal(quickMatchesFile(session, { name: 'vacation.mp4', size: 1 }), false);
});

test('offsetFromCompletedParts sums full-size parts and clamps the final partial part to what remains', () => {
  // 20MB file, 8MB chunks -> parts of 8MB, 8MB, 4MB
  const offset = offsetFromCompletedParts(
    [{ partNumber: 1, etag: 'a' }, { partNumber: 2, etag: 'b' }, { partNumber: 3, etag: 'c' }],
    20_000_000,
    8_000_000,
  );
  assert.equal(offset, 20_000_000);
});

test('offsetFromCompletedParts with only the first two parts stops short of the file size', () => {
  const offset = offsetFromCompletedParts(
    [{ partNumber: 1, etag: 'a' }, { partNumber: 2, etag: 'b' }],
    20_000_000,
    8_000_000,
  );
  assert.equal(offset, 16_000_000);
});

test('offsetFromCompletedParts with an invalid chunk size never claims false progress', () => {
  assert.equal(offsetFromCompletedParts([{ partNumber: 1, etag: 'a' }], 20_000_000, 0), 0);
});

test('progressPercent is bounded to [0, 100] and handles a zero-size file safely', () => {
  assert.equal(progressPercent(16_000_000, 20_000_000), 80);
  assert.equal(progressPercent(0, 20_000_000), 0);
  assert.equal(progressPercent(20_000_000, 20_000_000), 100);
  assert.equal(progressPercent(999, 0), 0);
});
