import { MediaUsageContext, UploadInitResponse, UploadSession } from '../../shared/types/media';
import { mediaApi } from './api/mediaApi';
import { sha256File } from '../../shared/crypto/sha256';
import { PersistedUploadPart, PersistedUploadSession, uploadSessionStore } from './UploadSessionStore';
import {
  ReconciliationOutcome,
  isPersistedSessionExpired,
  offsetFromCompletedParts,
  progressPercent,
  quickMatchesFile,
  reconcileSelectedFile,
} from './uploadReconciliation';

type Listener = (sessions: UploadSession[]) => void;

interface RuntimeUpload {
  file: File;
  context: MediaUsageContext;
  init?: UploadInitResponse;
  controllers: Set<AbortController>;
  completedParts: Map<number, string>;
  partLoaded: Map<number, number>;
  startedAt: number;
  /** SHA-256 hex digest of `file`, computed once so reload-resume can be verified. */
  contentHash?: string;
}

export type { ReconciliationOutcome, PersistedUploadSession };

const CHUNK_FALLBACK = 8 * 1024 * 1024;
const CONCURRENCY = 3;

const checksumSha256 = async (file: File): Promise<string> => sha256File(file);

const putSigned = (
  url: string,
  file: Blob,
  headers: Record<string, string> = {},
  signal: AbortSignal,
  onProgress: (loaded: number) => void,
): Promise<string> => new Promise((resolve, reject) => {
  const xhr = new XMLHttpRequest();
  xhr.open('PUT', url, true);
  Object.entries(headers).forEach(([key, value]) => xhr.setRequestHeader(key, value));
  xhr.upload.onprogress = event => {
    if (event.lengthComputable) onProgress(event.loaded);
  };
  let settled = false;
  const cleanup = () => signal.removeEventListener('abort', abort);
  const finish = (fn: () => void) => {
    if (settled) return;
    settled = true;
    cleanup();
    fn();
  };
  xhr.onload = () => {
    finish(() => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const etag = xhr.getResponseHeader('ETag') || xhr.getResponseHeader('etag') || '';
        resolve(etag.replace(/^"|"$/g, ''));
      } else {
        reject(new Error(`Signed upload failed with HTTP ${xhr.status}`));
      }
    });
  };
  xhr.onerror = () => finish(() => reject(new Error('Signed upload network error')));
  xhr.onabort = () => finish(() => reject(new DOMException('Upload paused', 'AbortError')));
  const abort = () => xhr.abort();
  if (signal.aborted) { xhr.abort(); return; }
  signal.addEventListener('abort', abort, { once: true });
  xhr.send(file);
});

const uploadSingle = async (
  url: string,
  file: Blob,
  headers: Record<string, string> = {},
  signal: AbortSignal,
  onProgress: (loaded: number) => void,
): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url, true);
    Object.entries(headers).forEach(([key, value]) => xhr.setRequestHeader(key, value));
    xhr.upload.onprogress = event => { if (event.lengthComputable) onProgress(event.loaded); };
    let settled = false;
    const abort = () => xhr.abort();
    const cleanup = () => signal.removeEventListener('abort', abort);
    const finish = (fn: () => void) => { if (settled) return; settled = true; cleanup(); fn(); };
    xhr.onload = () => finish(() => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Signed upload failed with HTTP ${xhr.status}`)));
    xhr.onerror = () => finish(() => reject(new Error('Signed upload network error')));
    xhr.onabort = () => finish(() => reject(new DOMException('Upload paused', 'AbortError')));
    if (signal.aborted) { xhr.abort(); return; }
    signal.addEventListener('abort', abort, { once: true });
    xhr.send(file);
  });
};

class GlobalUploadManager {
  private sessions: UploadSession[] = [];
  private runtimes = new Map<string, RuntimeUpload>();
  private listeners = new Set<Listener>();

  getSessions() { return [...this.sessions]; }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.getSessions());
    return () => { this.listeners.delete(listener); };
  }

  private notify() { const snapshot = this.getSessions(); this.listeners.forEach(listener => listener(snapshot)); }

  private patch(id: string, patch: Partial<UploadSession>) {
    this.sessions = this.sessions.map(s => s.id === id ? { ...s, ...patch, updatedAt: new Date().toISOString() } : s);
    this.notify();
  }

  async startUpload(file: File, context: MediaUsageContext): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const runtime: RuntimeUpload = {
      file, context,
      completedParts: new Map(), partLoaded: new Map(), startedAt: Date.now(), controllers: new Set(),
    };
    this.runtimes.set(id, runtime);
    this.sessions.unshift({
      id, fileName: file.name, fileSize: file.size, mimeType: file.type || 'application/octet-stream',
      context, state: 'CREATED', progress: 0, uploadedBytes: 0, speedBytesPerSec: 0,
      timeRemainingSec: 0, createdAt: now, updatedAt: now,
    });
    this.notify();
    void this.run(id);
    return id;
  }

  waitForCompletion(id: string): Promise<UploadSession> {
    return new Promise((resolve, reject) => {
      let unsubscribe = () => {};
      let settled = false;
      const inspect = (sessions: UploadSession[]) => {
        if (settled) return;
        const session = sessions.find(item => item.id === id);
        if (!session) return;
        if (session.state === 'READY') { settled = true; unsubscribe(); resolve(session); }
        if (['FAILED', 'CANCELLED', 'EXPIRED'].includes(session.state)) {
          settled = true;
          unsubscribe();
          reject(new Error(session.error || `Upload ended with state ${session.state}.`));
        }
      };
      unsubscribe = this.subscribe(inspect);
      if (settled) unsubscribe();
    });
  }

  private async run(id: string) {
    const runtime = this.runtimes.get(id);
    if (!runtime) return;
    try {
      this.patch(id, { state: 'PREPARING', processingStep: 'Calculating SHA-256 checksum…' });
      const checksum = await checksumSha256(runtime.file);
      if (!this.runtimes.has(id)) return;
      runtime.contentHash = checksum;

      const init = runtime.init ?? await mediaApi.initializeUpload({
        fileName: runtime.file.name,
        mimeType: runtime.file.type || 'application/octet-stream',
        sizeBytes: runtime.file.size,
        checksumSha256: checksum,
        context: runtime.context,
        multipart: true,
      }, id);
      runtime.init = init;
      void this.persistSession(id);

      if (Date.parse(init.expiresAt) <= Date.now()) throw new Error('Upload session expired before data transfer.');

      // Reflect any parts already completed (same-tab pause/resume, or a reload-resumed
      // session) instead of always resetting the visible progress bar to 0.
      const resumeChunkSize = init.chunkSizeBytes || CHUNK_FALLBACK;
      const alreadyUploadedBytes = offsetFromCompletedParts(
        Array.from(runtime.completedParts.entries()).map(([partNumber, etag]) => ({ partNumber, etag })),
        runtime.file.size,
        resumeChunkSize,
      );
      this.patch(id, {
        state: 'UPLOADING',
        progress: progressPercent(alreadyUploadedBytes, runtime.file.size),
        uploadedBytes: alreadyUploadedBytes,
        chunkSizeBytes: init.chunkSizeBytes,
        totalParts: init.totalParts,
        processingStep: init.mode === 'multipart' ? 'Uploading signed parts…' : 'Uploading to signed URL…',
      });

      await this.uploadParts(id, init.parts ?? []);
      if (this.sessions.find(s => s.id === id)?.state === 'PAUSED') return;

      if (init.mode === 'single') {
        await this.complete(id, []);
      } else {
        const chunkSize = runtime.init.chunkSizeBytes || CHUNK_FALLBACK;
        const totalParts = runtime.init.totalParts ?? Math.ceil(runtime.file.size / chunkSize);
        const completed = Array.from(runtime.completedParts.entries()).map(([partNumber, etag]) => ({
          partNumber, etag, sizeBytes: Math.min(chunkSize, Math.max(0, runtime.file.size - (partNumber - 1) * chunkSize)),
        }));
        if (completed.length !== totalParts) throw new Error('Upload did not complete all required parts.');
        await this.complete(id, completed);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        if (this.sessions.find(s => s.id === id)?.state !== 'CANCELLED') this.patch(id, { state: 'PAUSED', processingStep: 'Upload paused. Resume to continue.' });
        return;
      }
      const message = error instanceof Error ? error.message : 'Upload failed.';
      if (/expired/i.test(message)) {
        this.patch(id, { state: 'EXPIRED', error: message, processingStep: 'Upload session expired. Start a new upload.' });
        void this.deletePersisted(id);
        return;
      }
      this.patch(id, { state: 'FAILED', error: message, processingStep: 'Upload failed.' });
    }
  }

  private async uploadParts(id: string, initialParts: NonNullable<UploadInitResponse['parts']>) {
    const runtime = this.runtimes.get(id);
    if (!runtime?.init) return;
    const init = runtime.init;
    const chunkSize = init.chunkSizeBytes || CHUNK_FALLBACK;
    if (init.mode === 'single') {
      if (!init.uploadUrl) throw new Error('Upload contract error: single-part upload URL is missing.');
      const controller = new AbortController();
      runtime.controllers.add(controller);
      await uploadSingle(init.uploadUrl, runtime.file, init.uploadHeaders, controller.signal, loaded => {
        const elapsed = Math.max(1, (Date.now() - runtime.startedAt) / 1000);
        const speed = loaded / elapsed;
        this.patch(id, { uploadedBytes: loaded, progress: Math.round((loaded / runtime.file.size) * 100), speedBytesPerSec: speed, timeRemainingSec: Math.ceil((runtime.file.size - loaded) / Math.max(1, speed)) });
      });
      runtime.controllers.delete(controller);
      return;
    }
    const totalParts = init.totalParts ?? initialParts.length;
    const parts = new Map<number, NonNullable<UploadInitResponse['parts']>[number]>();
    initialParts.forEach(part => parts.set(part.partNumber, part));
    for (let n = 1; n <= totalParts; n++) {
      if (parts.has(n) || runtime.completedParts.has(n)) continue;
      const grant = await mediaApi.requestUploadPart(runtime.init.uploadId, n, crypto.randomUUID());
      parts.set(n, { partNumber: grant.partNumber, url: grant.request.url, headers: grant.request.headers });
    }
    const pending = Array.from(parts.values()).filter(part => !runtime.completedParts.has(part.partNumber));
    let cursor = 0;
    const worker = async () => {
      while (cursor < pending.length) {
        const part = pending[cursor++];
        const start = (part.partNumber - 1) * chunkSize;
        const end = Math.min(runtime.file.size, start + chunkSize);
        const blob = runtime.file.slice(start, end);
        let lastError: unknown;
        for (let attempt = 0; attempt < 3; attempt++) {
          const controller = new AbortController();
          runtime.controllers.add(controller);
          try {
            const etag = await putSigned(part.url, blob, part.headers, controller.signal, loaded => {
              runtime.partLoaded.set(part.partNumber, loaded);
              const completedBytes = Array.from(runtime.completedParts.keys()).reduce((sum, n) => sum + Math.min(chunkSize, Math.max(0, runtime.file.size - (n - 1) * chunkSize)), 0);
              const inFlightBytes = Array.from(runtime.partLoaded.entries()).reduce((sum, [n, value]) => runtime.completedParts.has(n) ? sum : sum + value, 0);
              const uploaded = Math.min(runtime.file.size, completedBytes + inFlightBytes);
              const elapsed = Math.max(1, (Date.now() - runtime.startedAt) / 1000);
              const speed = uploaded / elapsed;
              this.patch(id, { uploadedBytes: uploaded, progress: Math.round((uploaded / runtime.file.size) * 100), completedParts: Array.from(runtime.completedParts.keys()), speedBytesPerSec: speed, timeRemainingSec: Math.ceil((runtime.file.size - uploaded) / Math.max(1, speed)) });
            });
            runtime.completedParts.set(part.partNumber, etag);
            runtime.partLoaded.delete(part.partNumber);
            runtime.controllers.delete(controller);
            void this.persistSession(id);
            lastError = undefined;
            break;
          } catch (error) {
            runtime.controllers.delete(controller);
            runtime.partLoaded.delete(part.partNumber);
            lastError = error;
            if (error instanceof DOMException && error.name === 'AbortError') throw error;
            if (attempt < 2) { const baseDelay = 500 * 2 ** attempt; const jitter = Math.floor(Math.random() * Math.max(1, baseDelay * 0.25)); await new Promise(resolve => setTimeout(resolve, baseDelay + jitter)); }
          }
        }
        if (lastError) throw lastError instanceof Error ? lastError : new Error('Media part upload failed.');
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pending.length) }, () => worker()));
  }

  private async complete(id: string, parts: Array<{ partNumber: number; etag: string; sizeBytes: number }>) {
    const runtime = this.runtimes.get(id);
    if (!runtime?.init) return;
    if (Date.parse(runtime.init.expiresAt) <= Date.now()) {
      const refreshed = await mediaApi.getUpload(runtime.init.uploadId);
      if (Date.parse(refreshed.expiresAt) <= Date.now()) throw new Error('Upload session expired. Restart the upload to continue safely.');
      runtime.init = refreshed;
    }
    this.patch(id, { state: 'PROCESSING', progress: 100, processingStep: 'Waiting for server-side media processing…' });
    const result = await mediaApi.completeUpload(runtime.init.uploadId, parts, id);
    if (!result.mediaFileId) throw new Error('Upload completion response did not include mediaFileId.');
    await this.waitUntilMediaReady(result.mediaFileId);
    this.patch(id, { state: 'READY', mediaId: result.mediaFileId, processingStep: 'Media ready.' });
    this.runtimes.delete(id);
    void this.deletePersisted(id);
  }

  private async waitUntilMediaReady(mediaFileId: string): Promise<void> {
    for (let attempt = 0; attempt < 90; attempt++) {
      const asset = await mediaApi.getAsset(mediaFileId);
      if (asset.status === 'READY') return;
      if (asset.status === 'FAILED') throw new Error('Server-side media validation or processing failed.');
      await new Promise(resolve => setTimeout(resolve, 2_000));
    }
    throw new Error('Media processing timed out. Retry after the server finishes processing.');
  }

  pauseUpload(id: string) {
    const runtime = this.runtimes.get(id);
    if (!runtime) return;
    runtime.controllers.forEach(controller => controller.abort());
    this.patch(id, { state: 'PAUSED', processingStep: 'Upload paused. Resume to continue.' });
  }

  resumeUpload(id: string) {
    const session = this.sessions.find(s => s.id === id);
    const runtime = this.runtimes.get(id);
    if (!runtime || !session || !['PAUSED', 'FAILED'].includes(session.state)) return;
    this.patch(id, { state: 'PREPARING', error: undefined });
    void this.run(id);
  }

  async cancelUpload(id: string) {
    const runtime = this.runtimes.get(id);
    runtime?.controllers.forEach(controller => controller.abort());
    if (runtime?.init?.uploadId) {
      try {
        await mediaApi.cancelUpload(runtime.init.uploadId, 'user_cancelled', crypto.randomUUID());
      } catch (error) {
        this.patch(id, { state: 'FAILED', error: error instanceof Error ? error.message : 'Unable to cancel upload.', processingStep: 'Server cancellation failed. Retry cancellation.' });
        return;
      }
    }
    this.runtimes.delete(id);
    this.patch(id, { state: 'CANCELLED', processingStep: 'Upload cancelled.' });
    void this.deletePersisted(id);
  }

  abortAll(reason = 'security_action') {
    [...this.runtimes.keys()].forEach(id => {
      this.runtimes.get(id)?.controllers.forEach(controller => controller.abort());
      this.runtimes.delete(id);
      this.patch(id, { state: 'CANCELLED', processingStep: `Upload aborted: ${reason}` });
      void this.deletePersisted(id);
    });
  }

  retryUpload(id: string) {
    const session = this.sessions.find(s => s.id === id);
    if (!session) return;
    this.resumeUpload(id);
  }

  clearFinished() {
    this.sessions = this.sessions.filter(s => !['READY', 'CANCELLED', 'EXPIRED'].includes(s.state));
    this.notify();
  }

  /**
   * Best-effort durable snapshot of upload progress (metadata only, never the File
   * itself). A persistence failure here must never interrupt the active upload —
   * it only means reload-resume won't be available for this session.
   */
  private async persistSession(id: string): Promise<void> {
    const runtime = this.runtimes.get(id);
    const session = this.sessions.find(s => s.id === id);
    // Only multipart sessions are meaningfully resumable byte-for-byte; a single-shot
    // signed-URL upload has no partial progress to reconcile after a reload.
    if (!runtime?.init || runtime.init.mode !== 'multipart' || !session || !runtime.contentHash) return;
    const chunkSize = runtime.init.chunkSizeBytes || CHUNK_FALLBACK;
    const completedParts: PersistedUploadPart[] = Array.from(runtime.completedParts.entries())
      .map(([partNumber, etag]) => ({ partNumber, etag }));
    const record: PersistedUploadSession = {
      id,
      uploadId: runtime.init.uploadId,
      fileName: runtime.file.name,
      fileSize: runtime.file.size,
      mimeType: runtime.file.type || 'application/octet-stream',
      context: runtime.context,
      contentHash: runtime.contentHash,
      chunkSizeBytes: runtime.init.chunkSizeBytes,
      totalParts: runtime.init.totalParts,
      completedParts,
      offsetBytes: offsetFromCompletedParts(completedParts, runtime.file.size, chunkSize),
      expiresAt: runtime.init.expiresAt,
      createdAt: session.createdAt,
      updatedAt: new Date().toISOString(),
    };
    try {
      await uploadSessionStore.save(record);
    } catch {
      // Best-effort only — see docstring above.
    }
  }

  private async deletePersisted(id: string): Promise<void> {
    try {
      await uploadSessionStore.remove(id);
    } catch {
      // Best-effort only: an orphaned IndexedDB record is harmless — it will be
      // rejected as EXPIRED the next time reconciliation checks its TTL.
    }
  }

  /**
   * Sessions left over from a previous page load that are not yet re-attached to
   * a live upload in this tab. Already-expired records are pruned as a side effect.
   * The caller is expected to prompt the user to re-select each file (see
   * reconcileRecoverableSession) — nothing here resumes automatically.
   */
  async loadRecoverableSessions(): Promise<PersistedUploadSession[]> {
    const all = await uploadSessionStore.getAll().catch((): PersistedUploadSession[] => []);
    const recoverable: PersistedUploadSession[] = [];
    for (const persisted of all) {
      if (this.runtimes.has(persisted.id)) continue;
      if (isPersistedSessionExpired(persisted)) {
        await this.deletePersisted(persisted.id);
        continue;
      }
      recoverable.push(persisted);
    }
    return recoverable;
  }

  /**
   * Attempt to resume a persisted session with a freshly re-selected file.
   * Fail-closed at every step: a persisted record is never trusted as resumable
   * without (a) matching name/size, (b) a matching SHA-256 hash of the actual
   * file bytes, and (c) the server still recognising the upload session as live.
   * Any negative outcome is returned explicitly; nothing is silently retried as
   * a fresh upload, since that would upload the file from scratch without telling
   * the caller why the resume didn't happen.
   */
  async reconcileRecoverableSession(id: string, file: File): Promise<ReconciliationOutcome> {
    const persisted = await uploadSessionStore.get(id).catch((): PersistedUploadSession | undefined => undefined);
    const canSkipHash = !persisted || isPersistedSessionExpired(persisted) || !quickMatchesFile(persisted, file);
    const computedHash = canSkipHash ? null : await sha256File(file).catch(() => null);
    const clientOutcome = reconcileSelectedFile(persisted, file, computedHash ?? '', Date.now());
    if (clientOutcome.kind !== 'RESUMABLE') {
      if (clientOutcome.kind === 'EXPIRED' && persisted) await this.deletePersisted(id);
      return clientOutcome;
    }

    const record = persisted as PersistedUploadSession;
    let refreshed: UploadInitResponse;
    try {
      refreshed = await mediaApi.getUpload(record.uploadId);
    } catch {
      await this.deletePersisted(id);
      return { kind: 'EXPIRED' };
    }
    if (Date.parse(refreshed.expiresAt) <= Date.now()) {
      await this.deletePersisted(id);
      return { kind: 'EXPIRED' };
    }

    const runtime: RuntimeUpload = {
      file,
      context: record.context,
      init: refreshed,
      completedParts: new Map(record.completedParts.map(part => [part.partNumber, part.etag])),
      partLoaded: new Map(),
      startedAt: Date.now(),
      controllers: new Set(),
      contentHash: record.contentHash,
    };
    this.runtimes.set(id, runtime);

    const chunkSize = refreshed.chunkSizeBytes || record.chunkSizeBytes || CHUNK_FALLBACK;
    const offsetBytes = offsetFromCompletedParts(record.completedParts, file.size, chunkSize);
    const now = new Date().toISOString();
    this.sessions.unshift({
      id,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || record.mimeType,
      context: record.context,
      state: 'PREPARING',
      progress: progressPercent(offsetBytes, file.size),
      uploadedBytes: offsetBytes,
      speedBytesPerSec: 0,
      timeRemainingSec: 0,
      createdAt: record.createdAt,
      updatedAt: now,
      chunkSizeBytes: chunkSize,
      totalParts: refreshed.totalParts ?? record.totalParts,
      completedParts: Array.from(runtime.completedParts.keys()),
    });
    this.notify();
    void this.run(id);
    return { kind: 'RESUMABLE' };
  }

  /** User explicitly declines to resume: forget the local record and best-effort tell the server to abandon it. */
  async discardRecoverableSession(id: string): Promise<void> {
    const persisted = await uploadSessionStore.get(id).catch((): PersistedUploadSession | undefined => undefined);
    await this.deletePersisted(id);
    if (persisted?.uploadId) {
      try {
        await mediaApi.cancelUpload(persisted.uploadId, 'user_discarded_after_reload', crypto.randomUUID());
      } catch {
        // Best-effort only: the local record is already gone; the server session
        // will expire on its own TTL even if this cancellation doesn't land.
      }
    }
  }
}

export const globalUploadManager = new GlobalUploadManager();
