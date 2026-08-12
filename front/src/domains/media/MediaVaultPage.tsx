import React, { useState } from 'react';
import { FileText, LockKeyhole, RefreshCw, Search, ShieldCheck, Upload, X } from 'lucide-react';
import { mediaApi } from './api/mediaApi';
import { globalUploadManager } from './GlobalUploadManager';
import type { MediaAsset, UploadSession } from '../../shared/types/media';
import { PageError, PageEmpty } from '../../pages/common';
import { VideoPlayer } from './VideoPlayer';
import { PlaybackGrantService } from './PlaybackGrantService';
import { useAuth } from '../auth/AuthContext';

const formatBytes = (n: number) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(1)} GB`;
};

const UploadQueue: React.FC<{ sessions: UploadSession[] }> = ({ sessions }) => sessions.length ? <section className="space-y-2">
  {sessions.map(session => <div key={session.id} className="rounded-[var(--radius-2xl)] border border-subtle bg-surface p-4 shadow-token-sm">
    <div className="flex items-center gap-3">
      <Upload size={18} className="text-secondary" />
      <div className="min-w-0 flex-1">
        <div className="flex justify-between gap-3"><p className="truncate text-sm font-semibold">{session.fileName}</p><span className="text-xs text-muted">{Math.round(session.progress)}%</span></div>
        <div className="mt-2 h-2 overflow-hidden rounded-[var(--radius-pill)] bg-surface-subtle"><div className="h-full rounded-[var(--radius-pill)] bg-indigo-600" style={{ width: `${session.progress}%` }} /></div>
        <p className="mt-1 text-xs text-muted">{session.processingStep || session.state.toLowerCase()}{session.error ? ` · ${session.error}` : ''}</p>
      </div>
      {session.state === 'UPLOADING' && <button onClick={() => globalUploadManager.pauseUpload(session.id)} aria-label="Pause upload">Ⅱ</button>}
      {['PAUSED', 'FAILED'].includes(session.state) && <button onClick={() => globalUploadManager.resumeUpload(session.id)} aria-label="Resume upload">▶</button>}
      {!['READY', 'CANCELLED'].includes(session.state) && <button onClick={() => void globalUploadManager.cancelUpload(session.id)} aria-label="Cancel upload">×</button>}
    </div>
  </div>)}
</section> : null;

const MediaViewer: React.FC<{ asset: MediaAsset; onClose: () => void }> = ({ asset, onClose }) => {
  const [grant, setGrant] = useState<import('../../shared/types/media').PlaybackGrant>();
  const [error, setError] = useState<Error>();
  const isVideo = asset.kind === 'video';
  const isAudio = asset.kind === 'audio';

  React.useEffect(() => {
    if (!isVideo && !isAudio) return;
    let active = true;
    void PlaybackGrantService.requestPlaybackGrant(asset.id, 'POST_ATTACHMENT').then(g => active && setGrant(g)).catch(e => active && setError(e instanceof Error ? e : new Error('Playback authorization failed')));
    return () => { active = false; };
  }, [asset.id, isVideo, isAudio]);

  const poster = asset.thumbnails[0] ? undefined : undefined;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-3" role="dialog" aria-modal="true">
    <div className="relative max-h-[94vh] w-full max-w-4xl overflow-auto rounded-[var(--radius-3xl)] bg-surface p-4">
      <button onClick={onClose} className="absolute right-4 top-4 z-10 rounded-full bg-black/70 p-2 text-white" aria-label="Close media viewer"><X size={18} /></button>
      <div className="grid min-h-[50vh] place-items-center overflow-hidden rounded-[var(--radius-2xl)] bg-app">
        {isVideo && !grant && !error && <RefreshCw className="animate-spin text-white" />}
        {isVideo && error && <p className="p-8 text-white">{error.message}</p>}
        {isVideo && grant && <VideoPlayer src={grant.masterManifestUrl} poster={poster} playbackGrant={grant} title={asset.originalName ?? asset.objectKey} playbackContext="POST_ATTACHMENT" autoPlay />}
        {isAudio && !grant && !error && <RefreshCw className="animate-spin text-white" />}
        {isAudio && error && <p className="p-8 text-white">{error.message}</p>}
        {isAudio && grant && <audio controls className="w-full max-w-xl" src={grant.masterManifestUrl} />}
        {!isVideo && !isAudio && <div className="p-10 text-center text-white"><FileText size={40} className="mx-auto" /><p className="mt-3">{asset.originalName ?? asset.objectKey}</p><p className="mt-1 text-sm text-white/60">This backend does not expose a public media URL. Request an authorized playback/download grant for supported media.</p></div>}
      </div>
      <div className="px-2 pt-4"><h2 className="font-semibold text-primary">{asset.originalName ?? asset.objectKey}</h2><p className="mt-1 text-sm text-muted">{formatBytes(asset.sizeBytes)} · {asset.mimeType} · {asset.isEncrypted ? 'Encrypted' : 'Server-authorized'}</p><p className="mt-1 text-[11px] text-tertiary">Object: {asset.objectKey}</p></div>
    </div>
  </div>;
};

export const MediaVaultPage: React.FC = () => {
  const { user } = useAuth();
  const [mediaId, setMediaId] = useState('');
  const [asset, setAsset] = useState<MediaAsset | null>(null);
  const [sessions, setSessions] = React.useState<UploadSession[]>([]);
  const [error, setError] = useState<Error>();

  React.useEffect(() => globalUploadManager.subscribe(setSessions), []);

  const lookup = async () => {
    if (!mediaId.trim()) return;
    setError(undefined);
    try { setAsset(await mediaApi.getAsset(mediaId.trim())); } catch (e) { setAsset(null); setError(e instanceof Error ? e : new Error('Media lookup failed')); }
  };

  const onFiles = (files: FileList | null) => {
    if (!files || !user) return;
    Array.from(files).forEach(file => void globalUploadManager.startUpload(file, 'POST_ATTACHMENT'));
  };

  return <div className="mx-auto max-w-5xl space-y-5">
    <header className="rounded-[var(--radius-3xl)] border border-subtle bg-surface p-6 shadow-token-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div><div className="flex items-center gap-2"><ShieldCheck className="text-indigo-600" size={20} /><h1 className="text-2xl font-bold text-primary">Media</h1></div><p className="mt-1 text-sm text-muted">Uploads use server-created resumable sessions and signed object-storage requests. The backend does not expose a media-list or albums endpoint.</p></div>
        <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-xl)] bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white"><Upload size={17} /> Upload<input type="file" multiple className="hidden" onChange={e => onFiles(e.target.files)} /></label>
      </div>
      <div className="mt-5 flex gap-2"><label className="flex flex-1 items-center gap-2 rounded-[var(--radius-xl)] border border-subtle bg-surface-soft px-3"><Search size={16} className="text-tertiary" /><input value={mediaId} onChange={e => setMediaId(e.target.value)} placeholder="Server-issued media ID" className="w-full bg-transparent py-2.5 text-sm outline-none" /></label><button onClick={() => void lookup()} className="rounded-[var(--radius-xl)] border border-subtle px-4 text-sm font-semibold">Load</button></div>
    </header>
    <UploadQueue sessions={sessions} />
    {error && <PageError error={error} onRetry={() => void lookup()} />}
    {!asset && !error && <PageEmpty title="No media loaded" description="Upload a file or enter a server-issued media ID. The current backend does not provide a media library listing endpoint." />}
    {asset && <button className="group w-full overflow-hidden rounded-[var(--radius-2xl)] border border-subtle bg-surface text-left shadow-token-sm" onClick={() => setAsset(asset)}><div className="p-5"><div className="flex items-center gap-3"><LockKeyhole size={18} className="text-secondary" /><div><p className="font-semibold">{asset.originalName ?? asset.objectKey}</p><p className="text-sm text-muted">{formatBytes(asset.sizeBytes)} · {asset.status}</p></div></div></div></button>}
    {asset && <MediaViewer asset={asset} onClose={() => setAsset(null)} />}
  </div>;
};
