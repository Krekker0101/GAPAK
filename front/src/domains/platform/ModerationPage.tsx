import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Flag, ShieldCheck } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { PageError, PageLoading } from '../../pages/common';
import { moderationApi } from './api/platformApi';
import type { ModerationReport } from '../../shared/api/backendContracts';

const field = 'w-full rounded-xl border border-subtle bg-surface px-3 py-2 text-sm outline-none';

export const ModerationPage: React.FC = () => {
  const { user } = useAuth();
  const canModerate = user?.role === 'moderator' || user?.role === 'admin' || user?.role === 'super_admin';
  const canResolve = user?.role === 'admin' || user?.role === 'super_admin';
  const client = useQueryClient();
  const [form, setForm] = useState<{ targetType: ModerationReport['targetType']; targetId: string; reason: ModerationReport['reason']; description: string }>({ targetType: 'USER', targetId: '', reason: 'SPAM', description: '' });
  const own = useQuery({ queryKey: ['moderation', 'own'], queryFn: ({ signal }) => moderationApi.own(signal) });
  const queue = useQuery({ queryKey: ['moderation', 'queue'], queryFn: ({ signal }) => moderationApi.all(signal), enabled: canModerate });
  const refresh = () => void client.invalidateQueries({ queryKey: ['moderation'] });
  const create = useMutation({ mutationFn: () => moderationApi.create(form, crypto.randomUUID()), onSuccess: () => { setForm({ ...form, targetId: '', description: '' }); refresh(); } });
  const resolve = useMutation({ mutationFn: ({ id, status }: { id: string; status: 'RESOLVED' | 'DISMISSED' }) => moderationApi.resolve(id, status, '', crypto.randomUUID()), onSuccess: refresh });
  if (own.isPending || (canModerate && queue.isPending)) return <PageLoading label="Loading moderation reports…" />;
  if (own.isError) return <PageError error={own.error} onRetry={() => void own.refetch()} />;
  if (queue.isError) return <PageError error={queue.error} onRetry={() => void queue.refetch()} />;
  return <div className="mx-auto max-w-5xl space-y-5"><header className="rounded-3xl border border-subtle bg-surface p-6"><h1 className="flex items-center gap-2 text-2xl font-bold"><Flag className="text-rose-400" />Reports & Moderation</h1><p className="mt-1 text-sm text-muted">Every report and decision below comes from the backend audit trail.</p></header>
    <form onSubmit={e => { e.preventDefault(); create.mutate(); }} className="grid gap-3 rounded-3xl border border-subtle bg-surface p-5 md:grid-cols-2"><h2 className="font-semibold md:col-span-2">Submit a report</h2><select className={field} value={form.targetType} onChange={e => setForm({ ...form, targetType: e.target.value as ModerationReport['targetType'] })}>{['USER','POST','TRUST_ROOM','MEDIA'].map(v => <option key={v}>{v}</option>)}</select><input className={field} required pattern="[0-9a-fA-F-]{36}" value={form.targetId} onChange={e => setForm({ ...form, targetId: e.target.value })} placeholder="Target UUID" /><select className={field} value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value as ModerationReport['reason'] })}>{['HARASSMENT','SPAM','ILLEGAL_CONTENT','IMPERSONATION'].map(v => <option key={v}>{v}</option>)}</select><input className={field} maxLength={1000} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Additional context" /><button disabled={create.isPending} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white md:col-span-2">Submit report</button>{create.isError && <p className="text-sm text-rose-400 md:col-span-2">{create.error.message}</p>}</form>
    <ReportList title="Your reports" reports={own.data ?? []} />
    {canModerate && <ReportList title="Moderation queue" reports={queue.data ?? []} moderation={canResolve} onResolve={(id, status) => resolve.mutate({ id, status })} />}
  </div>;
};

const ReportList: React.FC<{ title: string; reports: ModerationReport[]; moderation?: boolean; onResolve?: (id: string, status: 'RESOLVED' | 'DISMISSED') => void }> = ({ title, reports, moderation, onResolve }) => <section className="rounded-3xl border border-subtle bg-surface p-5"><h2 className="flex items-center gap-2 font-semibold">{moderation && <ShieldCheck size={17} className="text-purple-400" />}{title}</h2>{!reports.length ? <p className="mt-4 text-sm text-muted">No reports.</p> : <div className="mt-3 divide-y divide-subtle">{reports.map(report => <article key={report.id} className="py-4"><div className="flex flex-wrap justify-between gap-2"><p className="font-medium">{report.targetType} · {report.reason}</p><span className="text-xs text-muted">{report.status}</span></div><p className="mt-1 break-all text-xs text-muted">Target: {report.targetId}</p>{report.description && <p className="mt-2 text-sm text-secondary">{report.description}</p>}{report.resolutionNote && <p className="mt-2 text-xs text-indigo-300">Resolution: {report.resolutionNote}</p>}{moderation && !['RESOLVED','DISMISSED'].includes(report.status) && <div className="mt-3 flex gap-2"><button onClick={() => onResolve?.(report.id, 'RESOLVED')} className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs text-white">Resolve</button><button onClick={() => onResolve?.(report.id, 'DISMISSED')} className="rounded-xl bg-slate-600 px-3 py-1.5 text-xs text-white">Dismiss</button></div>}</article>)}</div>}</section>;
