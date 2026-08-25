import React, { useEffect, useRef, useState } from 'react';
import { Upload, X, Pause, Play, RotateCcw, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { MediaUploadItem, MediaUploadStage } from '../../shared/types';
import type { MediaUsageContext } from '../../shared/types/media';
import { globalUploadManager } from './GlobalUploadManager';

interface Props {
  onMediaReady?: (item: MediaUploadItem) => void;
  maxFileSizeMB?: number;
  acceptedTypes?: string[];
  compact?: boolean;
  context?: MediaUsageContext;
}

const stageMap: Record<string, MediaUploadStage> = {
  CREATED: 'select', PREPARING: 'preparing', PAUSED: 'uploading', UPLOADING: 'uploading',
  PROCESSING: 'processing', READY: 'ready', FAILED: 'failed', CANCELLED: 'failed', EXPIRED: 'failed',
};

export const MediaUploadSubsystem: React.FC<Props> = ({
  onMediaReady,
  maxFileSizeMB = 250,
  acceptedTypes = ['image/*', 'video/*', 'audio/*', '.pdf', '.doc', '.docx', '.txt'],
  compact = false,
  context = 'POST_ATTACHMENT',
}) => {
  const [sessions, setSessions] = useState<ReturnType<typeof globalUploadManager.getSessions>>([]);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const objectUrls = useRef(new Map<string, string>());
  const emitted = useRef(new Set<string>());
  const ownedSessionIds = useRef(new Set<string>());

  useEffect(() => globalUploadManager.subscribe(items => setSessions(items.filter(item => item.context === context && ownedSessionIds.current.has(item.id)))), [context]);

  useEffect(() => {
    sessions.filter(s => s.state === 'READY' && s.mediaId && !emitted.current.has(s.id)).forEach(s => {
      emitted.current.add(s.id);
      onMediaReady?.({
        id: s.mediaId || s.id,
        fileName: s.fileName,
        fileSize: s.fileSize,
        mimeType: s.mimeType,
        stage: 'ready',
        progress: 100,
        uploadedBytes: s.uploadedBytes,
        totalBytes: s.fileSize,
        previewUrl: objectUrls.current.get(s.id),
      });
    });
  }, [sessions, onMediaReady]);

  useEffect(() => () => {
    objectUrls.current.forEach(url => URL.revokeObjectURL(url));
  }, []);

  const process = (files: FileList | File[]) => {
    Array.from(files).forEach(file => {
      if (file.size > maxFileSizeMB * 1024 * 1024) return;
      const preview = file.type.startsWith('image/') || file.type.startsWith('video/') ? URL.createObjectURL(file) : undefined;
      void globalUploadManager.startUpload(file, context).then(id => {
        ownedSessionIds.current.add(id);
        if (preview) objectUrls.current.set(id, preview);
        setSessions(globalUploadManager.getSessions().filter(item => item.context === context && ownedSessionIds.current.has(item.id)));
      });
    });
  };

  return <div className="w-full space-y-3">
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); process(e.dataTransfer.files); }}
      onClick={() => input.current?.click()}
      className={`cursor-pointer rounded-[var(--radius-2xl)] border-2 border-dashed p-5 text-center transition ${dragging ? 'border-indigo-500 bg-indigo-50' : 'border-default bg-surface-soft hover:border-strong'} ${compact ? 'py-4' : 'py-7'}`}
    >
      <input ref={input} type="file" multiple accept={acceptedTypes.join(',')} className="hidden" onChange={e => { if (e.target.files) process(e.target.files); e.currentTarget.value = ''; }} />
      <Upload className="mx-auto text-indigo-600" size={22} />
      <p className="mt-2 text-sm font-semibold text-primary">Upload media</p>
      <p className="mt-1 text-xs text-muted">Server-signed upload · resumable chunks · SHA-256 integrity</p>
    </div>

    {sessions.map(s => <div key={s.id} className="rounded-[var(--radius-xl)] border border-subtle bg-surface p-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex justify-between gap-3"><p className="truncate text-xs font-semibold">{s.fileName}</p><span className="text-xs text-muted">{Math.round(s.progress)}%</span></div>
          <div className="mt-2 h-1.5 rounded-[var(--radius-pill)] bg-surface-subtle"><div className="h-full rounded-[var(--radius-pill)] bg-indigo-600" style={{ width: `${s.progress}%` }} /></div>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-muted">
            {s.state === 'UPLOADING' && <Loader2 size={12} className="animate-spin" />}
            {s.state === 'READY' && <CheckCircle2 size={12} />}
            {s.state === 'FAILED' && <AlertCircle size={12} />}
            <span>{s.error || s.processingStep || s.state}</span>
          </div>
        </div>
        {s.state === 'UPLOADING' && <button onClick={e => { e.stopPropagation(); globalUploadManager.pauseUpload(s.id); }} aria-label="Pause upload"><Pause size={15} /></button>}
        {s.state === 'PAUSED' && <button onClick={e => { e.stopPropagation(); globalUploadManager.resumeUpload(s.id); }} aria-label="Resume upload"><Play size={15} /></button>}
        {s.state === 'FAILED' && <button onClick={e => { e.stopPropagation(); globalUploadManager.retryUpload(s.id); }} aria-label="Retry upload"><RotateCcw size={15} /></button>}
        {!['READY','CANCELLED'].includes(s.state) && <button onClick={e => { e.stopPropagation(); globalUploadManager.cancelUpload(s.id); }} aria-label="Cancel upload"><X size={15} /></button>}
      </div>
    </div>)}
  </div>;
};
