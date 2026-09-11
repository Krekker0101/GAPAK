import test from 'node:test';
import assert from 'node:assert/strict';
import { mapUploadSession } from '../../src/domains/media/api/uploadSessionMapping.ts';
import type { UploadSession } from '../../src/shared/api/backendContracts.ts';

const session: UploadSession = {
  id: 'session-id', mediaFileId: 'media-id', purpose: 'STORY', status: 'CREATED',
  bucket: 'private', objectKey: 'story.jpg', fileName: 'story.jpg', mimeType: 'image/jpeg',
  sizeBytes: 1024, partSizeBytes: 1024, totalParts: 1, expiresAt: '2030-01-01T00:00:00Z',
  partGrants: [{ partNumber: 1, request: { method: 'PUT', url: 'https://storage.example/part-1', headers: { 'Content-Type': 'image/jpeg' }, expiresAt: '2030-01-01T00:00:00Z' } }],
};

test('a small story uploads its one signed part instead of expecting uploadUrl', () => {
  const mapped = mapUploadSession(session);
  assert.equal(mapped.mode, 'multipart');
  assert.equal(mapped.totalParts, 1);
  assert.equal(mapped.parts?.[0].url, session.partGrants?.[0].request.url);
  assert.equal(mapped.parts?.[0].partNumber, 1);
  assert.equal(mapped.uploadUrl, undefined);
});

test('resuming a single-part story uses the part grant endpoint when grants are absent', () => {
  const mapped = mapUploadSession({ ...session, partGrants: undefined });
  assert.equal(mapped.mode, 'multipart');
  assert.equal(mapped.totalParts, 1);
  assert.equal(mapped.parts, undefined);
});

test('large stories retain their server-issued chunk size and part count', () => {
  const mapped = mapUploadSession({ ...session, totalParts: 4, partSizeBytes: 8 * 1024 * 1024 });
  assert.equal(mapped.mode, 'multipart');
  assert.equal(mapped.totalParts, 4);
  assert.equal(mapped.chunkSizeBytes, 8 * 1024 * 1024);
});

test('invalid session metadata is rejected before uploading bytes', () => {
  for (const totalParts of [0, -1, 1.5, NaN]) {
    assert.throws(() => mapUploadSession({ ...session, totalParts }), /invalid upload session/);
  }
  assert.throws(() => mapUploadSession({ ...session, partSizeBytes: 0 }), /invalid upload session/);
});
