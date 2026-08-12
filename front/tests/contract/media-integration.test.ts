import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8');

test('media uses only resumable upload-session endpoints', () => {
  const api = read('src/domains/media/api/mediaApi.ts');
  for (const route of ['/media/upload-sessions', '/parts', '/complete', '/abort', '/media/assets/', '/playback-grants']) assert.match(api, new RegExp(route.replaceAll('/', '\\/')));
  for (const legacy of ['/upload-intents', '/finalize', '/media/playback-grants']) assert.doesNotMatch(api, new RegExp(legacy.replaceAll('/', '\\/')));
});

test('media completion consumes server mediaFileId and does not fabricate an asset', () => {
  const api = read('src/domains/media/api/mediaApi.ts');
  const manager = read('src/domains/media/GlobalUploadManager.ts');
  assert.match(api, /BackendUploadSession/);
  assert.match(manager, /result\.mediaFileId/);
  assert.doesNotMatch(api, /ownerId:\s*['"]['"]|createdAt:\s*new Date|privacy:\s*['"]PRIVATE['"]/);
});

test('large-file hashing is incremental and bounded rather than file.arrayBuffer()', () => {
  const hash = read('src/shared/crypto/sha256.ts');
  assert.match(hash, /file\.slice\(/);
  assert.match(hash, /chunkSize/);
  assert.doesNotMatch(hash, /file\.arrayBuffer\(\)/);
});

test('media manager retries individual parts and resumes completed parts', () => {
  const manager = read('src/domains/media/GlobalUploadManager.ts');
  assert.match(manager, /runtime\.completedParts/);
  assert.match(manager, /for \(let attempt = 0; attempt < 3; attempt\+\+\)/);
  assert.match(manager, /requestUploadPart/);
  assert.match(manager, /getUpload/);
});

test('playback URL is taken from backend signed request', () => {
  const service = read('src/domains/media/PlaybackGrantService.ts');
  assert.match(service, /grant\.request\.url/);
  assert.doesNotMatch(service, /https?:\/\/.*cdn|new URL\(/);
});
