import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Lock, Plus, ShieldCheck, Users } from 'lucide-react';
import { PageError, PageLoading } from '../../pages/common';
import { trustRoomsApi } from './api/platformApi';
import type { CreateTrustRoomRequest, TrustRoomMember } from '../../shared/api/backendContracts';

const field = 'w-full rounded-xl border border-subtle bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500';

export const TrustRoomsPage: React.FC = () => {
  const { roomId } = useParams<{ roomId?: string }>();
  return roomId ? <RoomDetail roomId={roomId} /> : <RoomList />;
};

const RoomList: React.FC = () => {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CreateTrustRoomRequest>({ name: '', description: '', visibility: 'PRIVATE', accessMode: 'INVITE_ONLY', requireTwoFactor: true, minAccountAgeDays: 0, messageRetentionDays: 30 });
  const query = useQuery({ queryKey: ['trust-rooms'], queryFn: ({ signal }) => trustRoomsApi.list(signal) });
  const create = useMutation({ mutationFn: (input: CreateTrustRoomRequest) => trustRoomsApi.create(input, crypto.randomUUID()), onSuccess: () => { setOpen(false); void client.invalidateQueries({ queryKey: ['trust-rooms'] }); } });
  if (query.isPending) return <PageLoading label="Loading trust rooms…" />;
  if (query.isError) return <PageError error={query.error} onRetry={() => void query.refetch()} />;
  return <div className="mx-auto max-w-5xl space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-subtle bg-surface p-6"><div><h1 className="flex items-center gap-2 text-2xl font-bold"><Lock className="text-emerald-400" />Trust Rooms</h1><p className="mt-1 text-sm text-muted">Private membership and policy are loaded from the server.</p></div><button type="button" onClick={() => setOpen(v => !v)} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"><Plus className="mr-1 inline h-4 w-4" />New room</button></header>
    {open && <form className="grid gap-3 rounded-3xl border border-subtle bg-surface p-5 md:grid-cols-2" onSubmit={e => { e.preventDefault(); create.mutate(form); }}>
      <input className={field} required minLength={3} maxLength={120} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Room name" />
      <input className={field} maxLength={600} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description" />
      <select className={field} value={form.visibility} onChange={e => setForm({ ...form, visibility: e.target.value as CreateTrustRoomRequest['visibility'] })}><option value="PRIVATE">Private</option><option value="SECRET">Secret</option></select>
      <select className={field} value={form.accessMode} onChange={e => setForm({ ...form, accessMode: e.target.value as CreateTrustRoomRequest['accessMode'] })}><option value="INVITE_ONLY">Invite only</option><option value="REQUEST">Request</option><option value="OWNER_APPROVAL">Owner approval</option></select>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.requireTwoFactor} onChange={e => setForm({ ...form, requireTwoFactor: e.target.checked })} />Require two-factor authentication</label>
      <button disabled={create.isPending} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{create.isPending ? 'Creating…' : 'Create room'}</button>
      {create.isError && <p className="text-sm text-rose-400 md:col-span-2">{create.error.message}</p>}
    </form>}
    {!query.data.length ? <Empty text="You do not belong to any trust room yet." /> : <div className="grid gap-4 md:grid-cols-2">{query.data.map(room => <Link key={room.id} to={`/trust-rooms/${room.id}`} className="rounded-3xl border border-subtle bg-surface p-5 hover:border-indigo-500/50"><div className="flex items-start justify-between"><h2 className="font-semibold">{room.name}</h2><span className="text-xs text-muted">{room.visibility}</span></div>{room.description && <p className="mt-2 text-sm text-secondary">{room.description}</p>}<p className="mt-4 text-xs text-muted">{room.accessMode} · {room.requireTwoFactor ? '2FA required' : '2FA optional'}</p></Link>)}</div>}
  </div>;
};

const RoomDetail: React.FC<{ roomId: string }> = ({ roomId }) => {
  const client = useQueryClient();
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<TrustRoomMember['role']>('MEMBER');
  const query = useQuery({ queryKey: ['trust-rooms', roomId], queryFn: ({ signal }) => trustRoomsApi.get(roomId, signal) });
  const add = useMutation({ mutationFn: () => trustRoomsApi.addMember(roomId, { userId: userId.trim(), role }, crypto.randomUUID()), onSuccess: () => { setUserId(''); void client.invalidateQueries({ queryKey: ['trust-rooms', roomId] }); } });
  if (query.isPending) return <PageLoading label="Loading trust room…" />;
  if (query.isError) return <PageError error={query.error} onRetry={() => void query.refetch()} />;
  const detail = query.data;
  const canAdd = detail.currentUserRole === 'OWNER' || detail.currentUserRole === 'ADMIN';
  return <div className="mx-auto max-w-5xl space-y-5"><Link to="/trust-rooms" className="text-sm text-indigo-400">← All rooms</Link><header className="rounded-3xl border border-subtle bg-surface p-6"><h1 className="text-2xl font-bold">{detail.room.name}</h1><p className="mt-2 text-sm text-secondary">{detail.room.description}</p><div className="mt-4 flex gap-4 text-xs text-muted"><span><Users className="mr-1 inline h-4 w-4" />{detail.memberCount}</span><span><ShieldCheck className="mr-1 inline h-4 w-4" />{detail.currentUserRole}</span></div></header>
    {canAdd && <form className="flex flex-wrap gap-2 rounded-3xl border border-subtle bg-surface p-4" onSubmit={e => { e.preventDefault(); add.mutate(); }}><input className={`${field} min-w-64 flex-1`} required pattern="[0-9a-fA-F-]{36}" value={userId} onChange={e => setUserId(e.target.value)} placeholder="Backend user UUID" /><select className={field} value={role} onChange={e => setRole(e.target.value as TrustRoomMember['role'])}>{['ADMIN','MODERATOR','MEMBER','AUDITOR'].map(v => <option key={v}>{v}</option>)}</select><button disabled={add.isPending} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm text-white">Add member</button>{add.isError && <p className="w-full text-sm text-rose-400">{add.error.message}</p>}</form>}
    <section className="rounded-3xl border border-subtle bg-surface p-5"><h2 className="font-semibold">Members</h2><div className="mt-3 divide-y divide-subtle">{detail.members.map(member => <div key={member.userId} className="flex items-center justify-between py-3"><div><p className="font-medium">{member.displayName}</p><p className="text-xs text-muted">@{member.username}</p></div><span className="text-xs text-indigo-400">{member.role}</span></div>)}</div></section>
  </div>;
};

const Empty: React.FC<{ text: string }> = ({ text }) => <div className="rounded-3xl border border-subtle bg-surface p-10 text-center text-sm text-muted">{text}</div>;
