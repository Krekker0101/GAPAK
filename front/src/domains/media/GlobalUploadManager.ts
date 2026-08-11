import { MediaUsageContext, UploadInitResponse, UploadSession } from '../../shared/types/media';
import { mediaApi } from './api/mediaApi';

type Listener = (sessions: UploadSession[]) => void;

interface RuntimeUpload {
  file: File;
  context: MediaUsageContext;
  privacy?: string;
  albumId?: string;
  init?: UploadInitResponse;
  controllers: Set<AbortController>;
  completedParts: Map<number, string>;
  partLoaded: Map<number, number>;
  startedAt: number;
}

const CHUNK_FALLBACK = 8 * 1024 * 1024;
const CONCURRENCY = 3;

const checksumSha256 = async (file: File): Promise<string> => {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
};

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

class GlobalUploadManager {
  private sessions: UploadSession[] = [];
  private runtimes = new Map<string, RuntimeUpload>();
  private listeners = new Set<Listener>();

  getSessions() { return [...this.sessions]; }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.getSessions());
    return () => this.listeners.delete(listener);
  }

  private notify() { const snapshot = this.getSessions(); this.listeners.forEach(listener => listener(snapshot)); }

  private patch(id: string, patch: Partial<UploadSession>) {
    this.sessions = this.sessions.map(s => s.id === id ? { ...s, ...patch, updatedAt: new Date().toISOString() } : s);
    this.notify();
  }

  async startUpload(file: File, context: MediaUsageContext, options?: { privacy?: string; albumId?: string }): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const runtime: RuntimeUpload = {
      file, context, privacy: options?.privacy, albumId: options?.albumId,
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

  private async run(id: string) {
    const runtime = this.runtimes.get(id);
    if (!runtime) return;
    try {
      this.patch(id, { state: 'PREPARING', processingStep: 'Calculating SHA-256 checksum…' });
      const checksum = await checksumSha256(runtime.file);
      if (!this.runtimes.has(id)) return;

      const init = runtime.init ?? await mediaApi.initializeUpload({
        fileName: runtime.file.name,
        mimeType: runtime.file.type || 'application/octet-stream',
        sizeBytes: runtime.file.size,
        checksumSha256: checksum,
        context: runtime.context,
        privacy: runtime.privacy,
        albumId: runtime.albumId,
      }, id);
      runtime.init = init;

      this.patch(id, {
        state: 'UPLOADING',
        progress: 0,
        chunkSizeBytes: init.chunkSizeBytes,
        totalParts: init.parts?.length,
        processingStep: init.mode === 'multipart' ? 'Uploading signed parts…' : 'Uploading to signed URL…',
      });

      await this.uploadParts(id, init.parts ?? []);
      if (this.sessions.find(s => s.id === id)?.state === 'PAUSED') return;

      const chunkSize = runtime.init.chunkSizeBytes || CHUNK_FALLBACK;
      const totalParts = runtime.init.totalParts ?? Math.ceil(runtime.file.size / chunkSize);
      const completed = Array.from(runtime.completedParts.entries()).map(([partNumber, etag]) => ({
        partNumber, etag, sizeBytes: Math.min(chunkSize, Math.max(0, runtime.file.size - (partNumber - 1) * chunkSize)),
      }));
      if (completed.length !== totalParts) throw new Error('Upload did not complete all required parts.');
      await this.complete(id, completed);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        if (this.sessions.find(s => s.id === id)?.state !== 'CANCELLED') this.patch(id, { state: 'PAUSED', processingStep: 'Upload paused. Resume to continue.' });
        return;
      }
      const message = error instanceof Error ? error.message : 'Upload failed.';
      this.patch(id, { state: 'FAILED', error: message, processingStep: 'Upload failed.' });
    }
  }

  private async uploadParts(id: string, initialParts: NonNullable<UploadInitResponse['parts']>) {
    const runtime = this.runtimes.get(id);
    if (!runtime || !runtime.init) return;
    const chunkSize = runtime.init.chunkSizeBytes || CHUNK_FALLBACK;
    const totalParts = runtime.init.totalParts ?? Math.ceil(runtime.file.size / chunkSize);
    const parts = new Map<number, NonNullable<UploadInitResponse['parts']>[number]>();
    initialParts.forEach(part => parts.set(part.partNumber, part));
    for (let n = 1; n <= totalParts; n++) {
      if (!parts.has(n)) parts.set(n, await mediaApi.requestUploadPart(runtime.init.uploadId, n));
    }
    const pending = Array.from(parts.values()).filter(part => !runtime.completedParts.has(part.partNumber));
    let cursor = 0;

    const worker = async () => {
      while (cursor < pending.length) {
        const part = pending[cursor++];
        const start = (part.partNumber - 1) * chunkSize;
        const end = Math.min(runtime.file.size, start + chunkSize);
        const blob = runtime.file.slice(start, end);
        const controller = new AbortController();
        runtime.controllers.add(controller);
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
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pending.length) }, () => worker()));
  }

  private async complete(id: string, parts: Array<{ partNumber: number; etag: string; sizeBytes: number }>) {
    const runtime = this.runtimes.get(id);
    if (!runtime?.init) return;
    this.patch(id, { state: 'PROCESSING', progress: 100, processingStep: 'Waiting for server-side media processing…' });
    const result = await mediaApi.completeUpload(runtime.init.uploadId, { parts }, id);
    this.patch(id, { state: 'READY', mediaId: result.media.id, mediaUrl: result.media.previewUrl, processingStep: 'Media ready.' });
    this.runtimes.delete(id);
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

  cancelUpload(id: string) {
    const runtime = this.runtimes.get(id);
    runtime?.controllers.forEach(controller => controller.abort());
    this.runtimes.delete(id);
    this.patch(id, { state: 'CANCELLED', processingStep: 'Upload cancelled.' });
    if (runtime) void mediaApi.cancelUpload(runtime.init?.uploadId || id, crypto.randomUUID()).catch(() => undefined);
  }

  abortAll(reason = 'security_action') {
    [...this.runtimes.keys()].forEach(id => {
      this.runtimes.get(id)?.controllers.forEach(controller => controller.abort());
      this.runtimes.delete(id);
      this.patch(id, { state: 'CANCELLED', processingStep: `Upload aborted: ${reason}` });
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
}

export const globalUploadManager = new GlobalUploadManager();
