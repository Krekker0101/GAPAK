import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, Database, FileText, Search, Settings, Shield, Users } from 'lucide-react';
import { PermissionDeniedPage, PageError, PageLoading } from '../../pages/common';
import { useAuth } from '../auth/AuthContext';
import { adminApi } from './api/platformApi';
import type { AdminManagedPage } from '../../shared/api/backendContracts';

const roles = ['USER', 'MODERATOR', 'ADMIN', 'SECURITY_ANALYST'];
const statuses = ['ACTIVE', 'SUSPENDED', 'DELETED'];
const pageStatuses: AdminManagedPage['status'][] = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];
const localeOptions: AdminManagedPage['locale'][] = ['en', 'ru', 'tj'];
const inputClass = 'rounded-xl border border-subtle bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500';

export const AdminPage: React.FC = () => {
  const { user } = useAuth();
  const allowed = user?.role === 'admin' || user?.role === 'super_admin';
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [contentLocale, setContentLocale] = useState<AdminManagedPage['locale']>('en');
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [pageTitle, setPageTitle] = useState('');
  const [pageStatus, setPageStatus] = useState<AdminManagedPage['status']>('DRAFT');
  const [pageContent, setPageContent] = useState('{\n  "blocks": []\n}');

  const overview = useQuery({ queryKey: ['admin', 'overview'], queryFn: ({ signal }) => adminApi.overview(signal), enabled: allowed });
  const users = useQuery({ queryKey: ['admin', 'users', submittedSearch, offset], queryFn: ({ signal }) => adminApi.users({ search: submittedSearch || undefined, limit: 25, offset }, signal), enabled: allowed });
  const pages = useQuery({ queryKey: ['admin', 'pages', contentLocale], queryFn: ({ signal }) => adminApi.pages(contentLocale, signal), enabled: allowed });
  const selectedPage = useQuery({ queryKey: ['admin', 'page', selectedSlug, contentLocale], queryFn: ({ signal }) => adminApi.page(selectedSlug!, contentLocale, signal), enabled: allowed && Boolean(selectedSlug) });

  useEffect(() => {
    if (!selectedPage.data) return;
    setPageTitle(selectedPage.data.title);
    setPageStatus(selectedPage.data.status);
    setPageContent(JSON.stringify(selectedPage.data.content, null, 2));
  }, [selectedPage.data]);

  const updateUser = useMutation({
    mutationFn: ({ id, input }: { id: string; input: { role?: string; accountStatus?: string } }) => adminApi.updateUser(id, input, crypto.randomUUID()),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
  const updatePage = useMutation({
    mutationFn: async () => {
      if (!selectedSlug) throw new Error('Select a managed page first.');
      const parsed: unknown = JSON.parse(pageContent);
      if (!parsed || typeof parsed !== 'object' || !('blocks' in parsed) || !Array.isArray((parsed as { blocks?: unknown }).blocks)) {
        throw new Error('Content must be a JSON object with a blocks array.');
      }
      return adminApi.updatePage(selectedSlug, {
        locale: contentLocale,
        title: pageTitle.trim(),
        status: pageStatus,
        content: parsed as AdminManagedPage['content'],
      }, crypto.randomUUID());
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'pages'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'page', selectedSlug, contentLocale] });
    },
  });

  if (!allowed) return <PermissionDeniedPage />;
  if (overview.isPending || users.isPending || pages.isPending) return <PageLoading label="Loading administration data…" />;
  const error = overview.error ?? users.error ?? pages.error;
  if (error) return <PageError error={error} onRetry={() => { void overview.refetch(); void users.refetch(); void pages.refetch(); }} />;
  if (!overview.data || !users.data || !pages.data) return <PageError error={new Error('Administration response was empty')} />;

  const metrics = [
    ['Users', overview.data.totalUsers, Users],
    ['Active users', overview.data.activeUsers, Activity],
    ['Sessions', overview.data.activeSessions, Shield],
    ['Posts', overview.data.posts, Database],
    ['Trust rooms', overview.data.trustRooms, Settings],
    ['Security events 24h', overview.data.securityEvents24h, Shield],
  ] as const;

  return <div className="mx-auto max-w-6xl space-y-5">
    <header className="rounded-3xl border border-subtle bg-surface p-6"><h1 className="flex items-center gap-2 text-2xl font-bold"><Settings className="text-indigo-400" />Admin Console</h1><p className="mt-1 text-sm text-muted">Metrics generated {new Date(overview.data.generatedAt).toLocaleString()}.</p><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{metrics.map(([label, value, Icon]) => <div key={label} className="rounded-2xl bg-surface-soft p-4"><Icon size={17} className="text-indigo-400" /><p className="mt-2 text-2xl font-bold">{value}</p><p className="text-xs text-muted">{label}</p></div>)}</div></header>

    <section className="rounded-3xl border border-subtle bg-surface p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">User administration</h2><form className="flex items-center gap-2 rounded-xl border border-subtle px-3" onSubmit={(event) => { event.preventDefault(); setOffset(0); setSubmittedSearch(search.trim()); }}><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} className="bg-transparent py-2 text-sm outline-none" placeholder="Username, email or name" /></form></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="text-xs text-muted"><tr><th className="pb-3">User</th><th className="pb-3">Role</th><th className="pb-3">Status</th><th className="pb-3">2FA</th><th className="pb-3">Created</th></tr></thead><tbody className="divide-y divide-subtle">{users.data.users.map((item) => <tr key={item.id}><td className="py-3"><p className="font-medium">{item.displayName}</p><p className="text-xs text-muted">@{item.username}</p></td><td><select aria-label={`Role for ${item.username}`} value={item.role} onChange={(event) => updateUser.mutate({ id: item.id, input: { role: event.target.value } })} className="rounded-lg border border-subtle bg-surface px-2 py-1 text-xs">{roles.map((role) => <option key={role}>{role}</option>)}</select></td><td><select aria-label={`Status for ${item.username}`} value={item.accountStatus} onChange={(event) => updateUser.mutate({ id: item.id, input: { accountStatus: event.target.value } })} className="rounded-lg border border-subtle bg-surface px-2 py-1 text-xs">{statuses.map((status) => <option key={status}>{status}</option>)}</select></td><td>{item.twoFactorEnabled ? 'Enabled' : 'Disabled'}</td><td className="text-xs text-muted">{new Date(item.createdAt).toLocaleDateString()}</td></tr>)}</tbody></table></div><div className="mt-4 flex items-center justify-between"><p className="text-xs text-muted">{users.data.total} users</p><div className="flex gap-2"><button type="button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 25))} className="rounded-lg border border-subtle px-3 py-1.5 text-xs disabled:opacity-40">Previous</button><button type="button" disabled={offset + users.data.limit >= users.data.total} onClick={() => setOffset(offset + 25)} className="rounded-lg border border-subtle px-3 py-1.5 text-xs disabled:opacity-40">Next</button></div></div>{updateUser.isError && <p role="alert" className="mt-3 text-sm text-rose-400">{updateUser.error.message}</p>}</section>

    <section className="rounded-3xl border border-subtle bg-surface p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-semibold"><FileText size={17} className="text-indigo-400" />Managed content pages</h2><select className={inputClass} value={contentLocale} onChange={(event) => { setContentLocale(event.target.value as AdminManagedPage['locale']); setSelectedSlug(null); }}>{localeOptions.map((locale) => <option key={locale}>{locale}</option>)}</select></div><div className="mt-4 grid gap-4 lg:grid-cols-[280px_1fr]"><div className="space-y-2">{!pages.data.pages.length ? <p className="text-sm text-muted">No managed pages for this locale.</p> : pages.data.pages.map((page) => <button type="button" key={page.id} onClick={() => setSelectedSlug(page.slug)} className={`w-full rounded-xl border p-3 text-left ${selectedSlug === page.slug ? 'border-indigo-500 bg-indigo-500/10' : 'border-subtle'}`}><p className="font-medium">{page.title}</p><p className="mt-1 text-xs text-muted">/{page.slug} · v{page.version} · {page.status}</p></button>)}</div>{selectedSlug && <form onSubmit={(event) => { event.preventDefault(); updatePage.mutate(); }} className="space-y-3">{selectedPage.isPending ? <PageLoading label="Loading managed page…" /> : selectedPage.isError ? <PageError error={selectedPage.error} onRetry={() => void selectedPage.refetch()} /> : <><input required minLength={2} maxLength={160} className={`${inputClass} w-full`} value={pageTitle} onChange={(event) => setPageTitle(event.target.value)} /><select className={inputClass} value={pageStatus} onChange={(event) => setPageStatus(event.target.value as AdminManagedPage['status'])}>{pageStatuses.map((status) => <option key={status}>{status}</option>)}</select><textarea aria-label="Managed page content JSON" className={`${inputClass} min-h-64 w-full font-mono text-xs`} value={pageContent} onChange={(event) => setPageContent(event.target.value)} /><button disabled={updatePage.isPending} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{updatePage.isPending ? 'Saving…' : 'Save managed page'}</button>{updatePage.isError && <p role="alert" className="text-sm text-rose-400">{updatePage.error.message}</p>}</>}</form>}</div></section>
  </div>;
};
