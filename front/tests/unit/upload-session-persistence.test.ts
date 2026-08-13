import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file: string) => readFileSync(file, 'utf8');

test('upload session store persists metadata in IndexedDB and never the File object itself', () => {
  const source = read('src/domains/media/UploadSessionStore.ts');
  assert.match(source, /indexedDB\.open/);
  assert.match(source, /uploadId: string/);
  assert.match(source, /contentHash: string/);
  assert.match(source, /completedParts: PersistedUploadPart\[\]/);
  assert.match(source, /offsetBytes: number/);
  assert.match(source, /expiresAt: string/);
  // The whole point of this store is to never attempt to serialize a File/Blob.
  assert.doesNotMatch(source, /file:\s*File/);
  assert.doesNotMatch(source, /:\s*Blob/);
});

test('reconciliation is fail-closed: expiry and content are checked before ever trusting a resume', () => {
  const source = read('src/domains/media/uploadReconciliation.ts');
  assert.match(source, /isPersistedSessionExpired/);
  assert.match(source, /computedHash !== session\.contentHash/);
  assert.match(source, /kind: 'HASH_MISMATCH'/);
  assert.match(source, /kind: 'EXPIRED'/);
  assert.match(source, /kind: 'FILE_MISMATCH'/);
  assert.match(source, /kind: 'NOT_FOUND'/);
});

test('GlobalUploadManager persists progress durably and reconciles with the server before resuming', () => {
  const source = read('src/domains/media/GlobalUploadManager.ts');
  // Progress is saved as each part completes, not just at the end.
  assert.match(source, /runtime\.completedParts\.set\(part\.partNumber, etag\);\s*\n\s*runtime\.partLoaded\.delete\(part\.partNumber\);\s*\n\s*runtime\.controllers\.delete\(controller\);\s*\n\s*void this\.persistSession\(id\);/);
  // Only multipart sessions are persisted — a single-shot upload has no partial state to resume.
  assert.match(source, /runtime\.init\.mode !== 'multipart'/);
  // Reconciliation always re-confirms with the server before trusting a local record.
  assert.match(source, /await mediaApi\.getUpload\(record\.uploadId\)/);
  assert.match(source, /Date\.parse\(refreshed\.expiresAt\) <= Date\.now\(\)/);
  // Persisted metadata is removed once it's no longer useful: success, cancellation, or confirmed expiry.
  assert.match(source, /this\.patch\(id, \{ state: 'READY'.*\n\s*this\.runtimes\.delete\(id\);\s*\n\s*void this\.deletePersisted\(id\);/);
  assert.match(source, /this\.patch\(id, \{ state: 'CANCELLED', processingStep: 'Upload cancelled\.' \}\);\s*\n\s*void this\.deletePersisted\(id\);/);
  assert.match(source, /state: 'EXPIRED'/);
});

test('GlobalUploadManager never silently retries as a fresh upload on a failed reconciliation', () => {
  const source = read('src/domains/media/GlobalUploadManager.ts');
  assert.match(source, /clientOutcome\.kind !== 'RESUMABLE'/);
  assert.match(source, /return clientOutcome;/);
});

test('the upload recovery prompt requires the user to re-select a file and shows every negative outcome', () => {
  const source = read('src/domains/media/UploadRecoveryPrompt.tsx');
  assert.match(source, /type="file"/);
  assert.match(source, /reconcileRecoverableSession/);
  assert.match(source, /discardRecoverableSession/);
  assert.match(source, /FILE_MISMATCH/);
  assert.match(source, /HASH_MISMATCH/);
  assert.match(source, /EXPIRED/);
});

test('production app shell mounts the global upload center and the reload-recovery prompt', () => {
  const source = read('src/app/shell/AppShell.tsx');
  assert.match(source, /import \{ GlobalUploadCenter \} from '\.\.\/\.\.\/domains\/media\/GlobalUploadCenter'/);
  assert.match(source, /import \{ UploadRecoveryPrompt \} from '\.\.\/\.\.\/domains\/media\/UploadRecoveryPrompt'/);
  assert.match(source, /<GlobalUploadCenter \/>/);
  assert.match(source, /<UploadRecoveryPrompt \/>/);
});
