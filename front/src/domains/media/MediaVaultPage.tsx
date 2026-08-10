import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  FileAudio, FileText, Film, Image as ImageIcon, LockKeyhole, Pause, Play,
  RefreshCw, Search, ShieldCheck, Trash2, Upload, Video, X, RotateCcw
} from 'lucide-react';
import { mediaApi } from './api/mediaApi';
import { globalUploadManager } from './GlobalUploadManager';
import { MediaAsset, MediaKind, MediaPrivacy, UploadSession } from '../../shared/types/media';
import { Button, Badge } from '../../shared/design-system/primitives';
import { PageEmpty, PageError, PageLoading } from '../../pages/common';
import { VideoPlayer } from './VideoPlayer';
import { PlaybackGrantService } from './PlaybackGrantService';
import { useAuth } from '../auth/AuthContext';

const kinds: Array<{ value: MediaKind | ''; label: string }> = [
  { value: '', label: 'All media' }, { value: 'image', label: 'Images' }, { value: 'video', label: 'Videos' },
  { value: 'audio', label: 'Audio' }, { value: 'document', label: 'Documents' },
];

const kindIcon = (kind: MediaKind) => {
  if (kind === 'video') return <Film size={20} />;
  if (kind === 'audio') return <FileAudio size={20} />;
  if (kind === 'document') return <FileText size={20} />;
  return <ImageIcon size={20} />;
};

const formatBytes = (n: number) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(1)} GB`;
};

const UploadQueue: React.FC<{ sessions: UploadSession[] }> = ({ sessions }) => {
  if (!sessions.length) return null;
  return <section className="space-y-2">
    {sessions.map(session => <div key={session.id} className="rounded-[var(--radius-2xl)] border border-subtle bg-surface p-4 shadow-token-sm">
      <div className="flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-[var(--radius-xl)] bg-surface-subtle text-secondary"><Upload size={18} /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-sm font-semibold text-primary">{session.fileName}</p>
            <span className="text-xs text-muted">{Math.round(session.progress)}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-[var(--radius-pill)] bg-surface-subtle">
            <div className="h-full rounded-[var(--radius-pill)] bg-indigo-600 transition-[width]" style={{ width: `${session.progress}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted">{session.processingStep || session.state.toLowerCase()} {session.error ? `· ${session.error}` : ''}</p>
        </div>
        <div className="flex gap-1">
          {session.state === 'UPLOADING' && <button className="rounded-[var(--radius-lg)] p-2 hover:bg-surface-subtle" aria-label="Pause upload" onClick={() => globalUploadManager.pauseUpload(session.id)}><Pause size={16} /></button>}
          {['PAUSED','FAILED'].includes(session.state) && <button className="rounded-[var(--radius-lg)] p-2 hover:bg-surface-subtle" aria-label="Resume upload" onClick={() => globalUploadManager.resumeUpload(session.id)}><Play size={16} /></button>}
          {!['READY','CANCELLED'].includes(session.state) && <button className="rounded-[var(--radius-lg)] p-2 hover:bg-surface-subtle" aria-label="Cancel upload" onClick={() => globalUploadManager.cancelUpload(session.id)}><X size={16} /></button>}
        </div>
      </div>
    </div>)}
  </section>;
};

const MediaCard: React.FC<{ asset: MediaAsset; onOpen: (asset: MediaAsset) => void }> = ({ asset, onOpen }) => (
  <button onClick={() => onOpen(asset)} className="group overflow-hidden rounded-[var(--radius-2xl)] border border-subtle bg-surface text-left shadow-token-sm transition hover:-translate-y-0.5 hover:shadow-token-md">
    <div className="relative aspect-square bg-surface-subtle">
      {asset.thumbnailUrl || asset.previewUrl ? (
        asset.kind === 'image' ? <img loading="lazy" src={asset.thumbnailUrl || asset.previewUrl} alt={asset.fileName} className="h-full w-full object-cover" /> :
        <img loading="lazy" src={asset.thumbnailUrl || asset.previewUrl} alt="" className="h-full w-full object-cover opacity-90" />
      ) : <div className="grid h-full place-items-center text-tertiary">{kindIcon(asset.kind)}</div>}
      <div className="absolute left-2 top-2 flex gap-1">
        {asset.encrypted && <span className="grid size-7 place-items-center rounded-[var(--radius-pill)] bg-black/60 text-white"><LockKeyhole size={14} /></span>}
        {asset.privacy !== 'PUBLIC' && <span className="grid size-7 place-items-center rounded-[var(--radius-pill)] bg-black/60 text-white"><ShieldCheck size={14} /></span>}
      </div>
      {asset.kind === 'video' && <span className="absolute bottom-2 right-2 rounded-[var(--radius-pill)] bg-black/70 p-2 text-white"><Video size={14} /></span>}
    </div>
    <div className="p-3">
      <p className="truncate text-sm font-medium text-primary">{asset.fileName}</p>
      <p className="mt-1 text-xs text-muted">{formatBytes(asset.sizeBytes)} · {asset.privacy}</p>
    </div>
  </button>
);

export const MediaVaultPage: React.FC = () => {
  const { user } = useAuth();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<MediaKind | ''>('');
  const [privacy, setPrivacy] = useState<MediaPrivacy | ''>('');
  const [sort, setSort] = useState<'newest'|'oldest'|'name'|'size'>('newest');
  const [albumId, setAlbumId] = useState('');
  const [selected, setSelected] = useState<MediaAsset | null>(null);
  const [sessions, setSessions] = useState<UploadSession[]>([]);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => globalUploadManager.subscribe(setSessions), []);
  useEffect(() => { const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300); return () => window.clearTimeout(timer); }, [searchInput]);

  const query = useInfiniteQuery({
    queryKey: ['media', { search, kind, privacy, sort, albumId }],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => mediaApi.list({ cursor: pageParam, limit: 30, search: search || undefined, kind: kind || undefined, privacy: privacy || undefined, sort, albumId: albumId || undefined }, signal),
    getNextPageParam: last => last.hasMore ? last.nextCursor ?? undefined : undefined,
    staleTime: 30_000,
  });

  const albums = useQuery({
    queryKey: ['media', 'albums'],
    queryFn: ({ signal }) => mediaApi.albums({ limit: 50 }, signal),
    staleTime: 60_000,
  });

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !query.hasNextPage) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting && !query.isFetchingNextPage) void query.fetchNextPage();
    }, { rootMargin: '600px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [query.hasNextPage, query.isFetchingNextPage, query.fetchNextPage]);

  const assets = useMemo(() => query.data?.pages.flatMap(page => page.items) ?? [], [query.data]);

  if (query.isPending && !query.data) return <PageLoading label="Loading your media…" />;
  if (query.isError) return <PageError error={query.error} onRetry={() => void query.refetch()} />;

  const onFiles = (files: FileList | null) => {
    if (!files || !user) return;
    Array.from(files).forEach(file => void globalUploadManager.startUpload(file, 'POST_ATTACHMENT', { privacy: privacy || 'PRIVATE', albumId: albumId || undefined }));
  };

  return <div className="mx-auto max-w-6xl space-y-5">
    <header className="rounded-[var(--radius-3xl)] border border-subtle bg-surface p-6 shadow-token-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2"><ShieldCheck className="text-indigo-600" size={20} /><h1 className="text-2xl font-bold text-on-brand">Media Vault</h1></div>
          <p className="mt-1 max-w-2xl text-sm text-muted">Your server-authorized media library. Private assets are never assigned public CDN URLs by the client.</p>
        </div>
        <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-xl)] bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-surface-muted">
          <Upload size={17} /> Upload
          <input type="file" multiple className="hidden" onChange={e => onFiles(e.target.files)} accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt" />
        </label>
      </div>
      <div className="mt-5 grid gap-2 md:grid-cols-[1fr_auto_auto_auto_auto]">
        <label className="flex items-center gap-2 rounded-[var(--radius-xl)] border border-subtle bg-surface-soft px-3"><Search size={16} className="text-tertiary" /><input value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Search media…" className="w-full bg-transparent py-2.5 text-sm outline-none" /></label>
        <select value={kind} onChange={e => setKind(e.target.value as MediaKind | '')} className="rounded-[var(--radius-xl)] border border-subtle bg-surface px-3 py-2 text-sm">{kinds.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}</select>
        <select value={privacy} onChange={e => setPrivacy(e.target.value as MediaPrivacy | '')} className="rounded-[var(--radius-xl)] border border-subtle bg-surface px-3 py-2 text-sm"><option value="">All privacy</option><option value="PUBLIC">Public</option><option value="CONNECTIONS">Connections</option><option value="TRUSTED_CIRCLE">Trusted circle</option><option value="PRIVATE">Private</option></select>
        <select value={sort} onChange={e => setSort(e.target.value as typeof sort)} className="rounded-[var(--radius-xl)] border border-subtle bg-surface px-3 py-2 text-sm"><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="name">Name</option><option value="size">Size</option></select>
        <select value={albumId} onChange={e => setAlbumId(e.target.value)} className="rounded-[var(--radius-xl)] border border-subtle bg-surface px-3 py-2 text-sm"><option value="">All albums</option>{albums.data?.items.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
      </div>
    </header>

    <UploadQueue sessions={sessions} />

    {assets.length === 0 ? <PageEmpty title="Your vault is empty" description="Upload media to begin building your private library." /> :
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {assets.map(asset => <MediaCard key={asset.id} asset={asset} onOpen={setSelected} />)}
      </section>}

    <div ref={sentinel} className="h-10 grid place-items-center">{query.isFetchingNextPage && <RefreshCw className="animate-spin text-tertiary" size={18} />}</div>

    {selected && <MediaViewer asset={selected} onClose={() => setSelected(null)} />}
  </div>;
};

const MediaViewer: React.FC<{ asset: MediaAsset; onClose: () => void }> = ({ asset, onClose }) => {
  const [grant, setGrant] = useState<import('../../shared/types/media').PlaybackGrant>();
  const [error, setError] = useState<Error>();
  const [loadingGrant, setLoadingGrant] = useState(asset.kind === 'video' || asset.kind === 'audio');

  useEffect(() => {
    if (!['video','audio'].includes(asset.kind)) return;
    let active = true;
    void PlaybackGrantService.requestPlaybackGrant(asset.id, 'POST_ATTACHMENT').then(g => { if (active) { setGrant(g); setLoadingGrant(false); } }).catch(e => { if (active) { setError(e instanceof Error ? e : new Error('Playback authorization failed')); setLoadingGrant(false); } });
    return () => { active = false; };
  }, [asset]);

  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-3" role="dialog" aria-modal="true">
    <div className="relative max-h-[94vh] w-full max-w-4xl overflow-auto rounded-[var(--radius-3xl)] bg-surface p-4 shadow-token-lg">
      <button onClick={onClose} className="absolute right-4 top-4 z-10 rounded-[var(--radius-pill)] bg-black/70 p-2 text-white" aria-label="Close media viewer"><X size={18} /></button>
      <div className="min-h-[50vh] grid place-items-center bg-app rounded-[var(--radius-2xl)] overflow-hidden">
        {asset.kind === 'image' && (asset.previewUrl || asset.thumbnailUrl) && <img src={asset.previewUrl || asset.thumbnailUrl} alt={asset.fileName} className="max-h-[78vh] max-w-full object-contain" />}
        {asset.kind === 'document' && <div className="p-10 text-center text-white"><FileText size={40} className="mx-auto" /><p className="mt-3">{asset.fileName}</p><p className="mt-1 text-sm text-white/60">Document access is controlled by the server-issued asset URL.</p></div>}
        {asset.kind === 'video' && loadingGrant && <RefreshCw className="animate-spin text-white" />}
        {asset.kind === 'video' && error && <div className="p-8 text-center text-white"><p>{error.message}</p></div>}
        {asset.kind === 'video' && grant && <VideoPlayer src={grant.masterManifestUrl} poster={asset.thumbnailUrl} playbackGrant={grant} title={asset.fileName} playbackContext="POST_ATTACHMENT" autoPlay />}
        {asset.kind === 'audio' && loadingGrant && <RefreshCw className="animate-spin text-white" />}
        {asset.kind === 'audio' && grant && <audio controls className="w-full max-w-xl" src={grant.masterManifestUrl} />}
      </div>
      <div className="px-2 pt-4"><h2 className="font-semibold text-on-brand">{asset.fileName}</h2><p className="mt-1 text-sm text-muted">{formatBytes(asset.sizeBytes)} · {asset.privacy} · {asset.encrypted ? 'Encrypted' : 'Server-authorized'}</p></div>
    </div>
  </div>;
};
