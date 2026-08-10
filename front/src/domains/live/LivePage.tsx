import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Eye, MessageCircle, RefreshCw, ShieldCheck, Send, Radio } from 'lucide-react';
import { liveApi } from './api/liveApi';
import { realtimeManager } from '../../shared/realtime/RealtimeManager';
import { PageError, PageLoading } from '../../pages/common';
import { VideoPlayer } from '../media/VideoPlayer';
import { PlaybackGrantService } from '../media/PlaybackGrantService';
import { LiveChatMessage } from '../../shared/types/live';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../../shared/ux/ToastContext';

export const LivePage: React.FC<{ streamId?: string }> = ({ streamId }) => {
  const { user } = useAuth();
  const toast = useToast();
  const client = useQueryClient();
  const [chatText, setChatText] = useState('');
  const [chat, setChat] = useState<LiveChatMessage[]>([]);

  const list = useQuery({ queryKey: ['live'], queryFn: ({ signal }) => liveApi.list({ limit: 30 }, signal), enabled: !streamId, staleTime: 10_000 });
  const stream = useQuery({ queryKey: ['live', streamId], queryFn: ({ signal }) => liveApi.get(streamId!, signal), enabled: Boolean(streamId), staleTime: 5_000 });
  const chatQuery = useQuery({ queryKey: ['live','chat',streamId], queryFn: ({ signal }) => liveApi.chat(streamId!, { limit: 50 }, signal), enabled: Boolean(streamId), staleTime: 5_000 });

  useEffect(() => { if (chatQuery.data) setChat(chatQuery.data.items); }, [chatQuery.data]);

  useEffect(() => {
    if (!streamId) return;
    return realtimeManager.subscribe('live.chat.message', event => {
      const payload = event.payload as LiveChatMessage & { streamId?: string };
      if (payload.streamId !== streamId) return;
      setChat(current => current.some(m => m.id === payload.id) ? current : [...current, payload]);
    });
  }, [streamId]);

  useEffect(() => {
    if (!streamId) return;
    return realtimeManager.subscribe('live.update', event => {
      const payload = event.payload as { streamId?: string };
      if (payload.streamId === streamId) void client.invalidateQueries({ queryKey: ['live', streamId] });
    });
  }, [client, streamId]);

  if (!streamId) {
    if (list.isPending) return <PageLoading label="Loading live streams…" />;
    if (list.isError) return <PageError error={list.error} onRetry={() => void list.refetch()} />;
    const items = list.data?.items ?? [];
    return <div className="mx-auto max-w-6xl space-y-5">
      <header className="rounded-[var(--radius-3xl)] border border-subtle bg-surface p-6 shadow-token-sm"><div className="flex items-center gap-2"><Radio className="text-rose-600" /><h1 className="text-2xl font-bold">Live</h1></div><p className="mt-1 text-sm text-muted">Live state and viewer counts are server-owned and updated through realtime events.</p></header>
      {!items.length ? <div className="rounded-[var(--radius-3xl)] border border-subtle bg-surface p-10 text-center text-sm text-muted">No live streams are currently available.</div> :
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{items.map(item => <a key={item.id} href={`/live/${item.id}`} className="rounded-[var(--radius-3xl)] border border-subtle bg-surface p-4 shadow-token-sm hover:shadow-token-md">
        <div className="aspect-video overflow-hidden rounded-[var(--radius-2xl)] bg-surface-subtle">{item.coverImageUrl ? <img loading="lazy" src={item.coverImageUrl} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-tertiary"><Radio /></div>}</div>
        <div className="mt-3 flex items-center justify-between"><h2 className="font-semibold">{item.title}</h2><span className="text-xs text-muted">{item.currentViewersCount} viewers</span></div>
        <p className="mt-1 text-xs text-muted">{item.state}</p>
      </a>)}</div>}
    </div>;
  }

  if (stream.isPending) return <PageLoading label="Authorizing live stream…" />;
  if (stream.isError || !stream.data) return <PageError error={stream.error || new Error('Live stream not found')} onRetry={() => void stream.refetch()} />;
  const data = stream.data;

  return <LiveRoom stream={data} chat={chat} chatText={chatText} setChatText={setChatText} onSend={() => {
    if (!user || !chatText.trim()) return;
    const text = chatText.trim();
    setChatText('');
    const sent = realtimeManager.send({ id: crypto.randomUUID(), type: 'live.chat.send', timestamp: new Date().toISOString(), payload: { streamId: data.id, text } });
    if (!sent) toast.warning('Live chat is temporarily unavailable. Reconnect before sending.');
  }} />;
};

const LiveRoom: React.FC<{ stream: import('../../shared/types/live').LiveStream; chat: LiveChatMessage[]; chatText: string; setChatText: (v: string) => void; onSend: () => void }> = ({ stream, chat, chatText, setChatText, onSend }) => {
  const [grant, setGrant] = useState<import('../../shared/types/media').PlaybackGrant>();
  const [grantError, setGrantError] = useState<Error>();

  useEffect(() => {
    if (stream.state !== 'LIVE') return;
    let active = true;
    void liveApi.requestPlaybackGrant(stream.id).then(response => { if (active) setGrant(response.grant); }).catch(e => { if (active) setGrantError(e instanceof Error ? e : new Error('Playback authorization failed')); });
    return () => { active = false; };
  }, [stream.id, stream.state]);

  return <div className="mx-auto max-w-6xl space-y-4">
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <section className="overflow-hidden rounded-[var(--radius-3xl)] border border-subtle bg-app shadow-token-sm">
        <div className="aspect-video grid place-items-center">
          {stream.state === 'LIVE' && grant ? <VideoPlayer src={grant.masterManifestUrl} poster={stream.coverImageUrl} playbackGrant={grant} title={stream.title} playbackContext="LIVE_REPLAY" autoPlay /> :
           stream.state === 'LIVE' && !grantError ? <RefreshCw className="animate-spin text-white" /> :
           <div className="text-center text-white"><Radio className="mx-auto" /><p className="mt-3 font-semibold">{stream.state === 'SCHEDULED' ? 'Stream scheduled' : stream.state === 'PREPARING' ? 'Preparing stream…' : stream.state === 'ENDED' ? 'Stream ended' : 'Stream unavailable'}</p>{grantError && <p className="mt-1 text-xs text-white/60">{grantError.message}</p>}</div>}
        </div>
        <div className="p-5 text-white"><h1 className="text-xl font-bold">{stream.title}</h1><div className="mt-2 flex flex-wrap gap-3 text-xs text-white/60"><span className="inline-flex items-center gap-1"><Eye size={14} /> {stream.currentViewersCount} viewers</span><span>{stream.state}</span></div></div>
      </section>
      <section className="flex min-h-[520px] flex-col rounded-[var(--radius-3xl)] border border-subtle bg-surface shadow-token-sm">
        <div className="border-b border-subtle p-4"><div className="flex items-center gap-2 font-semibold"><MessageCircle size={18} /> Live chat</div></div>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">{chat.map(message => <div key={message.id}><p className="text-xs font-semibold">{message.sender.displayName}</p><p className="text-sm text-secondary">{message.text}</p></div>)}</div>
        <form onSubmit={e => { e.preventDefault(); onSend(); }} className="border-t border-subtle p-3 flex gap-2"><input value={chatText} onChange={e => setChatText(e.target.value)} placeholder="Say something…" className="min-w-0 flex-1 rounded-[var(--radius-xl)] bg-surface-subtle px-3 py-2 text-sm outline-none" /><button className="rounded-[var(--radius-xl)] bg-indigo-600 px-3 text-white" aria-label="Send message"><Send size={16} /></button></form>
      </section>
    </div>
  </div>;
};
