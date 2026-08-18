import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, BellOff, Check, UserRoundCheck, X } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { PageError, PageLoading } from '../../pages/common';
import { subscriptionsPlatformApi } from './api/platformApi';
import type { SubscriptionCreator, SubscriptionNotificationPreferences } from '../../shared/api/backendContracts';

const inputClass = 'rounded-xl border border-subtle bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500';

export const SubscriptionsPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [creatorId, setCreatorId] = useState('');
  const [requestMessage, setRequestMessage] = useState('');
  const [blockUserId, setBlockUserId] = useState('');

  const following = useQuery({ queryKey: ['subscriptions', 'following'], queryFn: ({ signal }) => subscriptionsPlatformApi.following(signal) });
  const pending = useQuery({ queryKey: ['subscriptions', 'pending'], queryFn: ({ signal }) => subscriptionsPlatformApi.pending(signal) });
  const stats = useQuery({ queryKey: ['subscriptions', 'stats', user?.id], queryFn: ({ signal }) => subscriptionsPlatformApi.stats(user!.id, signal), enabled: Boolean(user) });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
  const unsubscribe = useMutation({ mutationFn: (id: string) => subscriptionsPlatformApi.unsubscribe(id, crypto.randomUUID()), onSuccess: refresh });
  const changeType = useMutation({ mutationFn: ({ id, type }: { id: string; type: 'VISIBLE' | 'SILENT' }) => subscriptionsPlatformApi.changeType(id, type, crypto.randomUUID()), onSuccess: refresh });
  const approve = useMutation({ mutationFn: (id: string) => subscriptionsPlatformApi.approve(id, crypto.randomUUID()), onSuccess: refresh });
  const reject = useMutation({ mutationFn: (id: string) => subscriptionsPlatformApi.reject(id, crypto.randomUUID()), onSuccess: refresh });
  const subscribe = useMutation({ mutationFn: () => subscriptionsPlatformApi.subscribe(creatorId.trim(), crypto.randomUUID()), onSuccess: () => { setCreatorId(''); refresh(); } });
  const request = useMutation({ mutationFn: () => subscriptionsPlatformApi.request(creatorId.trim(), requestMessage.trim(), crypto.randomUUID()), onSuccess: () => { setCreatorId(''); setRequestMessage(''); refresh(); } });
  const block = useMutation({ mutationFn: () => subscriptionsPlatformApi.block(blockUserId.trim(), crypto.randomUUID()), onSuccess: () => setBlockUserId('') });
  const unblock = useMutation({ mutationFn: () => subscriptionsPlatformApi.unblock(blockUserId.trim(), crypto.randomUUID()), onSuccess: () => setBlockUserId('') });

  if (following.isPending || pending.isPending || stats.isPending) return <PageLoading label="Loading subscriptions…" />;
  const firstError = following.error ?? pending.error ?? stats.error;
  if (firstError) return <PageError error={firstError} onRetry={() => { void following.refetch(); void pending.refetch(); void stats.refetch(); }} />;

  return <div className="mx-auto max-w-5xl space-y-5">
    <header className="rounded-3xl border border-subtle bg-surface p-6"><h1 className="flex items-center gap-2 text-2xl font-bold"><UserRoundCheck className="text-purple-400" />Subscriptions</h1><div className="mt-4 grid grid-cols-3 gap-3">{[['Followers', stats.data?.followersCount], ['Following', stats.data?.followingCount], ['Pending', stats.data?.pendingRequestsCount]].map(([label, value]) => <div key={String(label)} className="rounded-2xl bg-surface-soft p-3 text-center"><p className="text-xl font-bold">{value ?? 0}</p><p className="text-xs text-muted">{label}</p></div>)}</div></header>

    <section className="rounded-3xl border border-subtle bg-surface p-5"><h2 className="font-semibold">Follow a creator</h2><form onSubmit={(event) => { event.preventDefault(); subscribe.mutate(); }} className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto_auto]"><input required pattern="[0-9a-fA-F-]{36}" className={inputClass} value={creatorId} onChange={(event) => setCreatorId(event.target.value)} placeholder="Creator UUID" /><input maxLength={500} className={inputClass} value={requestMessage} onChange={(event) => setRequestMessage(event.target.value)} placeholder="Private-account request message" /><button disabled={subscribe.isPending || request.isPending} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-50">Follow</button><button type="button" disabled={!creatorId.trim() || subscribe.isPending || request.isPending} onClick={() => request.mutate()} className="rounded-xl border border-indigo-500/30 px-4 py-2 text-sm text-indigo-300 disabled:opacity-50">Request access</button></form>{(subscribe.isError || request.isError) && <p role="alert" className="mt-3 text-sm text-rose-400">{(subscribe.error ?? request.error)?.message}</p>}</section>

    <section className="rounded-3xl border border-subtle bg-surface p-5"><h2 className="font-semibold">Following</h2>{!following.data?.length ? <p className="mt-5 text-sm text-muted">You are not following anyone.</p> : <div className="mt-3 divide-y divide-subtle">{following.data.map((item) => <FollowingRow key={item.id} item={item} onChangeType={(type) => changeType.mutate({ id: item.id, type })} onUnsubscribe={() => unsubscribe.mutate(item.id)} />)}</div>}</section>

    <section className="rounded-3xl border border-subtle bg-surface p-5"><h2 className="font-semibold">Incoming requests</h2>{!pending.data?.items.length ? <p className="mt-5 text-sm text-muted">No pending requests.</p> : <div className="mt-3 divide-y divide-subtle">{pending.data.items.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 py-3"><div><p className="text-sm font-medium">Subscriber {item.subscriberId}</p>{item.message && <p className="text-xs text-muted">{item.message}</p>}</div><div className="flex gap-2"><button type="button" aria-label="Approve" onClick={() => approve.mutate(item.id)} className="rounded-xl bg-emerald-600 p-2 text-white"><Check size={15} /></button><button type="button" aria-label="Reject" onClick={() => reject.mutate(item.id)} className="rounded-xl bg-rose-600 p-2 text-white"><X size={15} /></button></div></div>)}</div>}</section>

    <section className="rounded-3xl border border-subtle bg-surface p-5"><h2 className="font-semibold">Block management</h2><div className="mt-3 flex flex-wrap gap-2"><input required pattern="[0-9a-fA-F-]{36}" className={`${inputClass} min-w-64 flex-1`} value={blockUserId} onChange={(event) => setBlockUserId(event.target.value)} placeholder="User UUID" /><button type="button" disabled={!blockUserId.trim() || block.isPending || unblock.isPending} onClick={() => block.mutate()} className="rounded-xl bg-rose-600 px-4 py-2 text-sm text-white disabled:opacity-50">Block</button><button type="button" disabled={!blockUserId.trim() || block.isPending || unblock.isPending} onClick={() => unblock.mutate()} className="rounded-xl border border-subtle px-4 py-2 text-sm disabled:opacity-50">Unblock</button></div>{(block.isError || unblock.isError) && <p role="alert" className="mt-3 text-sm text-rose-400">{(block.error ?? unblock.error)?.message}</p>}</section>

    {(unsubscribe.isError || changeType.isError || approve.isError || reject.isError) && <p role="alert" className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-400">The server rejected the subscription update. Refresh and try again.</p>}
  </div>;
};

const FollowingRow: React.FC<{ item: SubscriptionCreator; onChangeType: (type: 'VISIBLE' | 'SILENT') => void; onUnsubscribe: () => void }> = ({ item, onChangeType, onUnsubscribe }) => {
  const queryClient = useQueryClient();
  const preferences = useQuery({ queryKey: ['subscriptions', 'notifications', item.id], queryFn: ({ signal }) => subscriptionsPlatformApi.notificationPreferences(item.id, signal) });
  const update = useMutation({
    mutationFn: (next: SubscriptionNotificationPreferences) => subscriptionsPlatformApi.setNotificationPreferences(item.id, {
      notifyOnPost: next.notifyOnPost,
      notifyOnStory: next.notifyOnStory,
      notifyOnLive: next.notifyOnLive,
      notifyOnClip: next.notifyOnClip,
      muteMinutes: next.isMuted ? 60 : 0,
    }, crypto.randomUUID()),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['subscriptions', 'notifications', item.id] }),
  });
  const patch = (changes: Partial<SubscriptionNotificationPreferences>) => {
    if (!preferences.data) return;
    update.mutate({ ...preferences.data, ...changes });
  };
  return <div className="py-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-medium">{item.displayName}</p><p className="text-xs text-muted">@{item.username}</p></div><div className="flex items-center gap-2"><select aria-label={`Subscription type for ${item.displayName}`} value={item.subscriptionType} onChange={(event) => onChangeType(event.target.value as 'VISIBLE' | 'SILENT')} className="rounded-xl border border-subtle bg-surface px-2 py-1.5 text-xs"><option value="VISIBLE">Visible</option><option value="SILENT">Silent</option></select><button type="button" onClick={onUnsubscribe} className="rounded-xl border border-rose-500/30 px-3 py-1.5 text-xs text-rose-400">Unfollow</button></div></div>{preferences.isPending ? <p className="mt-2 text-xs text-muted">Loading notification preferences…</p> : preferences.isError ? <button type="button" onClick={() => void preferences.refetch()} className="mt-2 text-xs text-rose-400">Could not load preferences · Retry</button> : preferences.data && <div className="mt-3 flex flex-wrap gap-2">{([['Posts', 'notifyOnPost'], ['Stories', 'notifyOnStory'], ['Live', 'notifyOnLive'], ['Clips', 'notifyOnClip']] as const).map(([label, key]) => <button type="button" key={key} disabled={update.isPending} onClick={() => patch({ [key]: !preferences.data[key] })} className={`rounded-lg border px-2.5 py-1 text-xs ${preferences.data[key] ? 'border-indigo-500/30 text-indigo-300' : 'border-subtle text-muted'}`}>{label}</button>)}<button type="button" disabled={update.isPending} onClick={() => patch({ isMuted: !preferences.data.isMuted })} className="inline-flex items-center gap-1 rounded-lg border border-subtle px-2.5 py-1 text-xs">{preferences.data.isMuted ? <BellOff size={13} /> : <Bell size={13} />}{preferences.data.isMuted ? 'Muted' : 'Active'}</button>{update.isError && <span className="text-xs text-rose-400">{update.error.message}</span>}</div>}</div>;
};
