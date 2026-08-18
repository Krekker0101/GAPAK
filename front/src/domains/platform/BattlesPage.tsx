import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Flame, Plus, Trophy } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { PageError, PageLoading } from '../../pages/common';
import { battlesApi } from './api/platformApi';
import type { CreateBattleRequest } from '../../shared/api/backendContracts';

const field = 'rounded-xl border border-subtle bg-surface px-3 py-2 text-sm outline-none';

export const BattlesPage: React.FC = () => {
  const { user } = useAuth();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CreateBattleRequest>({ opponentUserId: '', mode: 'DUEL', title: '', roundDurationSec: 60 });
  const query = useQuery({ queryKey: ['battles'], queryFn: ({ signal }) => battlesApi.list(1, signal) });
  const refresh = () => void client.invalidateQueries({ queryKey: ['battles'] });
  const create = useMutation({ mutationFn: () => battlesApi.create(form, crypto.randomUUID()), onSuccess: () => { setOpen(false); refresh(); } });
  const respond = useMutation({ mutationFn: ({ id, accept }: { id: string; accept: boolean }) => battlesApi.respond(id, accept, crypto.randomUUID()), onSuccess: refresh });
  const vote = useMutation({ mutationFn: ({ id, target }: { id: string; target: 'HOST_A' | 'HOST_B' | 'DRAW' }) => battlesApi.vote(id, target, crypto.randomUUID()), onSuccess: refresh });
  if (query.isPending) return <PageLoading label="Loading creator battles…" />;
  if (query.isError) return <PageError error={query.error} onRetry={() => void query.refetch()} />;
  return <div className="mx-auto max-w-5xl space-y-5"><header className="flex items-center justify-between rounded-3xl border border-subtle bg-surface p-6"><div><h1 className="flex items-center gap-2 text-2xl font-bold"><Flame className="text-amber-500" />Creator Battles</h1><p className="mt-1 text-sm text-muted">Challenges, scores and votes are server-authoritative.</p></div><button onClick={() => setOpen(v => !v)} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm text-white"><Plus className="mr-1 inline h-4 w-4" />Challenge</button></header>
    {open && <form onSubmit={e => { e.preventDefault(); create.mutate(); }} className="grid gap-3 rounded-3xl border border-subtle bg-surface p-5 md:grid-cols-2"><input className={field} required pattern="[0-9a-fA-F-]{36}" value={form.opponentUserId} onChange={e => setForm({ ...form, opponentUserId: e.target.value })} placeholder="Opponent user UUID" /><input className={field} required minLength={3} maxLength={120} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Battle title" /><select className={field} value={form.mode} onChange={e => setForm({ ...form, mode: e.target.value as CreateBattleRequest['mode'] })}><option value="DUEL">Duel</option><option value="CREATOR_DUEL">Creator duel</option><option value="ROOM_DUEL">Room duel</option></select><input className={field} type="number" min={15} max={1800} value={form.roundDurationSec} onChange={e => setForm({ ...form, roundDurationSec: Number(e.target.value) })} /><button disabled={create.isPending} className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white md:col-span-2">{create.isPending ? 'Creating…' : 'Create challenge'}</button>{create.isError && <p className="text-sm text-rose-400 md:col-span-2">{create.error.message}</p>}</form>}
    {!query.data.length ? <div className="rounded-3xl border border-subtle bg-surface p-10 text-center text-sm text-muted">No visible battles.</div> : <div className="space-y-4">{query.data.map(battle => { const invited = battle.opponentUserId === user?.id && battle.status === 'PENDING_RESPONSE'; return <article key={battle.id} className="rounded-3xl border border-subtle bg-surface p-5"><div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="font-semibold">{battle.title}</h2><p className="text-xs text-muted">{battle.mode} · {battle.status}</p></div><span className="flex items-center gap-1 text-sm"><Trophy size={15} className="text-amber-400" />{battle.scoreHostA} : {battle.scoreHostB}</span></div><div className="mt-4 grid gap-2 text-xs text-muted sm:grid-cols-2"><p>Challenger: {battle.challengerUserId}</p><p>Opponent: {battle.opponentUserId}</p><p>Rounds: {battle.roundCount}</p><p>Round: {battle.roundDurationSec}s</p></div>{invited && <div className="mt-4 flex gap-2"><button onClick={() => respond.mutate({ id: battle.id, accept: true })} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs text-white">Accept</button><button onClick={() => respond.mutate({ id: battle.id, accept: false })} className="rounded-xl bg-rose-600 px-3 py-2 text-xs text-white">Decline</button></div>}{['LIVE','ROUND_ACTIVE'].includes(battle.status) && <div className="mt-4 flex flex-wrap gap-2">{(['HOST_A','DRAW','HOST_B'] as const).map(target => <button key={target} onClick={() => vote.mutate({ id: battle.id, target })} className="rounded-xl border border-indigo-500/30 px-3 py-2 text-xs text-indigo-300">Vote {target.replace('_',' ')}</button>)}</div>}</article>; })}</div>}
    {(respond.isError || vote.isError) && <p role="alert" className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-400">The battle action was rejected by the server.</p>}
  </div>;
};
