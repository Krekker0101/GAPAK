import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, MessageCircle, Plus, Radio, Send } from 'lucide-react';
import { liveApi } from './api/liveApi';
import { PageError, PageLoading } from '../../pages/common';
import type { LiveChatMessage, LiveStream } from '../../shared/api/backendContracts';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../../shared/ux/ToastContext';

type LiveChatDeliveryStatus = 'pending' | 'sent' | 'failed';
type LiveChatViewMessage = Partial<LiveChatMessage> & Pick<LiveChatMessage, 'streamId' | 'senderId' | 'body'> & {
  clientMessageId?: string;
  deliveryStatus?: LiveChatDeliveryStatus;
};

type CreateLiveForm = {
  title: string;
  description: string;
  visibility: 'PUBLIC' | 'FRIENDS' | 'TRUSTED_CIRCLE' | 'PRIVATE' | 'TRUST_ROOM';
  trustRoomId: string;
  scheduledFor: string;
  allowReplay: boolean;
};

const fieldClass = 'w-full rounded-xl border border-subtle bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500';

export const LivePage: React.FC<{ streamId?: string }> = ({ streamId }) => {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [chatText, setChatText] = useState('');
  const [chat, setChat] = useState<LiveChatViewMessage[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateLiveForm>({
    title: '',
    description: '',
    visibility: 'PUBLIC',
    trustRoomId: '',
    scheduledFor: '',
    allowReplay: true,
  });

  const list = useQuery({
    queryKey: ['live'],
    queryFn: ({ signal }) => liveApi.list({ limit: 30 }, signal),
    enabled: !streamId,
    staleTime: 10_000,
  });
  const stream = useQuery({
    queryKey: ['live', streamId],
    queryFn: ({ signal }) => liveApi.get(streamId!, signal),
    enabled: Boolean(streamId),
    staleTime: 5_000,
  });
  const chatQuery = useQuery({
    queryKey: ['live', 'chat', streamId],
    queryFn: ({ signal }) => liveApi.chat(streamId!, { limit: 50 }, signal),
    enabled: Boolean(streamId),
    staleTime: 5_000,
  });
  const eventsQuery = useQuery({
    queryKey: ['live', 'events', streamId],
    queryFn: ({ signal }) => liveApi.events(streamId!, { limit: 50 }, signal),
    enabled: Boolean(streamId),
    refetchInterval: stream.data?.status === 'LIVE' ? 10_000 : false,
  });

  useEffect(() => {
    if (!chatQuery.data) return;
    setChat((current) => {
      const unresolved = current.filter((message) => message.deliveryStatus === 'pending' || message.deliveryStatus === 'failed');
      return [...chatQuery.data, ...unresolved];
    });
  }, [chatQuery.data]);

  const createStream = useMutation({
    mutationFn: async () => {
      const scheduledFor = createForm.scheduledFor ? new Date(createForm.scheduledFor).toISOString() : undefined;
      return liveApi.create({
        title: createForm.title.trim(),
        ...(createForm.description.trim() ? { description: createForm.description.trim() } : {}),
        visibility: createForm.visibility,
        ...(createForm.visibility === 'TRUST_ROOM' ? { trustRoomId: createForm.trustRoomId.trim() } : {}),
        ...(scheduledFor ? { scheduledFor } : {}),
        allowReplay: createForm.allowReplay,
      }, crypto.randomUUID());
    },
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ['live'] });
      navigate(`/live/${encodeURIComponent(created.id)}`);
    },
  });

  const lifecycle = useMutation({
    mutationFn: async (action: 'start' | 'end') => {
      if (!streamId) throw new Error('Live stream is not selected.');
      const result = action === 'start'
        ? await liveApi.start(streamId, crypto.randomUUID())
        : await liveApi.end(streamId, crypto.randomUUID());
      if (!result.accepted) throw new Error(`The server did not accept the ${action} request.`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['live'] });
      void queryClient.invalidateQueries({ queryKey: ['live', streamId] });
    },
  });

  const join = useMutation({
    mutationFn: async () => {
      if (!streamId) throw new Error('Live stream is not selected.');
      const result = await liveApi.join(streamId, { role: 'VIEWER', isGhostMode: false }, crypto.randomUUID());
      if (!result.accepted) throw new Error('The server did not accept the join request.');
    },
    onSuccess: () => {
      toast.success('Joined live stream', 'Your viewer presence is registered by the server.');
      void queryClient.invalidateQueries({ queryKey: ['live', streamId] });
    },
    onError: (error) => toast.error('Could not join live stream', error instanceof Error ? error.message : 'The server rejected the join request.'),
  });

  if (!streamId) {
    if (list.isPending) return <PageLoading label="Loading live streams…" />;
    if (list.isError) return <PageError error={list.error} onRetry={() => void list.refetch()} />;
    const items = list.data ?? [];
    return <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-subtle bg-surface p-6 shadow-token-sm">
        <div><div className="flex items-center gap-2"><Radio className="text-rose-600" /><h1 className="text-2xl font-bold">Live</h1></div><p className="mt-1 text-sm text-muted">Streams, lifecycle state and viewer counts come from the backend.</p></div>
        <button type="button" onClick={() => setShowCreate((value) => !value)} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"><Plus className="mr-1 inline h-4 w-4" />Create stream</button>
      </header>
      {showCreate && <form onSubmit={(event) => { event.preventDefault(); createStream.mutate(); }} className="grid gap-3 rounded-3xl border border-subtle bg-surface p-5 md:grid-cols-2">
        <input className={fieldClass} required minLength={3} maxLength={120} value={createForm.title} onChange={(event) => setCreateForm({ ...createForm, title: event.target.value })} placeholder="Stream title" />
        <select className={fieldClass} value={createForm.visibility} onChange={(event) => setCreateForm({ ...createForm, visibility: event.target.value as CreateLiveForm['visibility'] })}>{['PUBLIC', 'FRIENDS', 'TRUSTED_CIRCLE', 'PRIVATE', 'TRUST_ROOM'].map((value) => <option key={value}>{value}</option>)}</select>
        <textarea className={`${fieldClass} md:col-span-2`} maxLength={1000} value={createForm.description} onChange={(event) => setCreateForm({ ...createForm, description: event.target.value })} placeholder="Description" />
        {createForm.visibility === 'TRUST_ROOM' && <input className={fieldClass} required pattern="[0-9a-fA-F-]{36}" value={createForm.trustRoomId} onChange={(event) => setCreateForm({ ...createForm, trustRoomId: event.target.value })} placeholder="Trust room UUID" />}
        <label className="text-xs text-muted">Schedule (optional)<input className={`${fieldClass} mt-1`} type="datetime-local" value={createForm.scheduledFor} onChange={(event) => setCreateForm({ ...createForm, scheduledFor: event.target.value })} /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={createForm.allowReplay} onChange={(event) => setCreateForm({ ...createForm, allowReplay: event.target.checked })} />Allow server replay</label>
        <button disabled={createStream.isPending} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{createStream.isPending ? 'Creating…' : 'Create stream'}</button>
        {createStream.isError && <p role="alert" className="text-sm text-rose-400 md:col-span-2">{createStream.error.message}</p>}
      </form>}
      {!items.length ? <div className="rounded-3xl border border-subtle bg-surface p-10 text-center text-sm text-muted">No visible live streams.</div> : <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{items.map((item) => <Link key={item.id} to={`/live/${item.id}`} className="rounded-3xl border border-subtle bg-surface p-4 shadow-token-sm hover:border-indigo-500/40"><div className="grid aspect-video place-items-center rounded-2xl bg-surface-subtle text-tertiary"><Radio /></div><div className="mt-3 flex items-center justify-between gap-2"><h2 className="truncate font-semibold">{item.title}</h2><span className="text-xs text-muted">{item.viewerCount} viewers</span></div><p className="mt-1 text-xs text-muted">{item.status} · {item.visibility}</p></Link>)}</div>}
    </div>;
  }

  if (stream.isPending) return <PageLoading label="Loading live stream…" />;
  if (stream.isError || !stream.data) return <PageError error={stream.error ?? new Error('Live stream not found')} onRetry={() => void stream.refetch()} />;
  if (chatQuery.isError) return <PageError error={chatQuery.error} onRetry={() => void chatQuery.refetch()} />;
  if (eventsQuery.isError) return <PageError error={eventsQuery.error} onRetry={() => void eventsQuery.refetch()} />;
  const data = stream.data;
  const isHost = data.hostUserId === user?.id;

  const sendLiveChat = (body: string, existingClientMessageId?: string) => {
    if (!user || data.status !== 'LIVE') return;
    const clientMessageId = existingClientMessageId ?? crypto.randomUUID();
    setChat((current) => current.some((item) => item.clientMessageId === clientMessageId)
      ? current.map((item) => item.clientMessageId === clientMessageId ? { ...item, deliveryStatus: 'pending' } : item)
      : [...current, { streamId: data.id, senderId: user.id, body, clientMessageId, deliveryStatus: 'pending' }]);
    void liveApi.postChat(data.id, body, clientMessageId)
      .then((message) => {
        setChat((current) => current.map((item) => item.clientMessageId === clientMessageId ? { ...message, clientMessageId, deliveryStatus: 'sent' } : item));
        setChatText('');
      })
      .catch((error) => {
        setChat((current) => current.map((item) => item.clientMessageId === clientMessageId ? { ...item, deliveryStatus: 'failed' } : item));
        toast.error('Live chat unavailable', error instanceof Error ? error.message : 'The message could not be sent.');
      });
  };

  return <div className="mx-auto max-w-6xl space-y-4"><Link to="/live" className="text-sm text-indigo-400">← All streams</Link><div className="grid gap-4 lg:grid-cols-[1fr_360px]">
    <section className="overflow-hidden rounded-3xl border border-subtle bg-surface shadow-token-sm"><div className="grid aspect-video place-items-center bg-surface-subtle"><div className="text-center text-secondary"><Radio className="mx-auto" /><p className="mt-3 font-semibold">{data.status}</p><p className="mt-1 text-xs text-muted">Playback becomes available only when the backend publishes an authorized manifest.</p></div></div><div className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-xl font-bold">{data.title}</h1>{data.description && <p className="mt-1 text-sm text-secondary">{data.description}</p>}</div><div className="flex gap-2">{isHost && !['LIVE', 'ENDED'].includes(data.status) && <button disabled={lifecycle.isPending} onClick={() => lifecycle.mutate('start')} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs text-white">Start</button>}{isHost && data.status === 'LIVE' && <button disabled={lifecycle.isPending} onClick={() => lifecycle.mutate('end')} className="rounded-xl bg-rose-600 px-3 py-2 text-xs text-white">End</button>}{!isHost && data.status === 'LIVE' && <button disabled={join.isPending} onClick={() => join.mutate()} className="rounded-xl bg-indigo-600 px-3 py-2 text-xs text-white">Join as viewer</button>}</div></div><div className="mt-3 flex flex-wrap gap-3 text-xs text-muted"><span className="inline-flex items-center gap-1"><Eye size={14} />{data.viewerCount} viewers</span><span>{data.visibility}</span><span>{data.allowReplay ? 'Replay enabled' : 'No replay'}</span></div>{lifecycle.isError && <p role="alert" className="mt-3 text-sm text-rose-400">{lifecycle.error.message}</p>}</div></section>
    <LiveChat stream={data} messages={chat} chatText={chatText} setChatText={setChatText} onRetry={(message) => { if (message.clientMessageId) sendLiveChat(message.body, message.clientMessageId); }} onSend={() => { const body = chatText.trim(); if (body) sendLiveChat(body); }} />
  </div>
  <section className="rounded-3xl border border-subtle bg-surface p-5"><h2 className="font-semibold">Stream events</h2>{!eventsQuery.data?.length ? <p className="mt-3 text-sm text-muted">No stream events have been recorded.</p> : <div className="mt-3 divide-y divide-subtle">{eventsQuery.data.slice(-20).reverse().map((event) => <div key={event.id} className="flex items-center justify-between gap-3 py-2 text-xs"><span>{event.eventType}</span><span className="text-muted">#{event.sequence} · {new Date(event.createdAt).toLocaleString()}</span></div>)}</div>}</section>
  </div>;
};

const LiveChat: React.FC<{ stream: LiveStream; messages: LiveChatViewMessage[]; chatText: string; setChatText: (value: string) => void; onSend: () => void; onRetry: (message: LiveChatViewMessage) => void }> = ({ stream, messages, chatText, setChatText, onSend, onRetry }) => <section className="flex min-h-[520px] flex-col rounded-3xl border border-subtle bg-surface shadow-token-sm"><div className="border-b border-subtle p-4"><div className="flex items-center gap-2 font-semibold"><MessageCircle size={18} />Live chat</div></div><div className="flex-1 space-y-3 overflow-y-auto p-4">{messages.map((message) => <div key={message.id ?? message.clientMessageId}><p className="text-xs font-semibold">{message.senderId}</p><p className="text-sm text-secondary">{message.body}</p>{message.deliveryStatus === 'pending' && <p className="text-[10px] text-muted">Sending…</p>}{message.deliveryStatus === 'failed' && <button type="button" className="text-[10px] font-semibold text-rose-400" onClick={() => onRetry(message)}>Retry</button>}</div>)}</div>{stream.status === 'LIVE' ? <form onSubmit={(event) => { event.preventDefault(); onSend(); }} className="flex gap-2 border-t border-subtle p-3"><input maxLength={500} value={chatText} onChange={(event) => setChatText(event.target.value)} placeholder="Say something…" className="min-w-0 flex-1 rounded-xl bg-surface-subtle px-3 py-2 text-sm outline-none" /><button className="rounded-xl bg-indigo-600 px-3 text-white" aria-label="Send message"><Send size={16} /></button></form> : <p className="border-t border-subtle p-4 text-xs text-muted">Chat is available while the stream is live.</p>}</section>;
