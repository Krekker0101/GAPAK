import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { Activity, Search } from 'lucide-react';
import { PageError, PageLoading } from '../../pages/common';
import { presenceApi } from './api/platformApi';
import { useAuth } from '../auth/AuthContext';
import { authManager } from '../../shared/api/authManager';

export const PresenceHeartbeat: React.FC = () => {
  const location = useLocation();
  const { setPresenceStatus } = useAuth();
  const connectionId = useRef(crypto.randomUUID());
  const path = useRef(location.pathname);
  path.current = location.pathname;
  useEffect(() => {
    let active = true;
    const heartbeat = () => {
      const state = document.visibilityState === 'visible' ? 'ACTIVE' : 'IDLE';
      void presenceApi.heartbeat(connectionId.current, state, path.current).then((presence) => {
        if (active) setPresenceStatus(presence.isOnline && presence.state === 'ACTIVE' ? 'online' : 'away');
      }).catch(() => undefined);
    };
    heartbeat();
    const timer = window.setInterval(heartbeat, 30_000);
    document.addEventListener('visibilitychange', heartbeat);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', heartbeat);
      // An auth-failure unmount has already cleared the in-memory credential.
      // Avoid a guaranteed CSRF/auth failure from a best-effort disconnect POST.
      if (authManager.getAccessToken()) {
        void presenceApi.disconnect(connectionId.current, 'app_shell_unmounted').catch(() => undefined);
      }
    };
  }, [setPresenceStatus]);
  return null;
};

export const PresencePage: React.FC = () => {
  const [input, setInput] = useState('');
  const [targetId, setTargetId] = useState<string | null>(null);
  const me = useQuery({ queryKey: ['presence', 'me'], queryFn: ({ signal }) => presenceApi.me(signal), refetchInterval: 30_000 });
  const target = useQuery({ queryKey: ['presence', targetId], queryFn: ({ signal }) => presenceApi.get(targetId!, signal), enabled: Boolean(targetId) });
  if (me.isPending) return <PageLoading label="Loading presence…" />;
  if (me.isError) return <PageError error={me.error} onRetry={() => void me.refetch()} />;
  return <div className="mx-auto max-w-3xl space-y-5"><header className="rounded-3xl border border-subtle bg-surface p-6"><h1 className="flex items-center gap-2 text-2xl font-bold"><Activity className="text-emerald-400" />Presence</h1><PresenceCard label="Your server presence" value={me.data} /></header>
    <section className="rounded-3xl border border-subtle bg-surface p-5"><h2 className="font-semibold">Check a user</h2><form className="mt-3 flex gap-2" onSubmit={e => { e.preventDefault(); setTargetId(input.trim()); }}><label className="flex flex-1 items-center gap-2 rounded-xl border border-subtle px-3"><Search size={16} /><input required pattern="[0-9a-fA-F-]{36}" value={input} onChange={e => setInput(e.target.value)} className="w-full bg-transparent py-2 text-sm outline-none" placeholder="Backend user UUID" /></label><button className="rounded-xl bg-indigo-600 px-4 text-sm text-white">Check</button></form>{target.isFetching && <p className="mt-4 text-sm text-muted">Loading…</p>}{target.isError && <PageError error={target.error} onRetry={() => void target.refetch()} />}{target.data && <PresenceCard label="User presence" value={target.data} />}</section>
  </div>;
};

const PresenceCard: React.FC<{ label: string; value: { userId: string; state: string; isOnline: boolean; lastSeenAt?: string | null; canViewOnlineStatus: boolean; canViewLastSeen: boolean } }> = ({ label, value }) => <div className="mt-4 rounded-2xl bg-surface-soft p-4"><div className="flex items-center justify-between"><p className="font-medium">{label}</p><span className={`rounded-full px-2 py-1 text-xs ${value.isOnline ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-500/15 text-muted'}`}>{value.canViewOnlineStatus ? value.state : 'PRIVATE'}</span></div><p className="mt-2 break-all text-xs text-muted">{value.userId}</p>{value.canViewLastSeen && value.lastSeenAt && <p className="mt-1 text-xs text-muted">Last seen {new Date(value.lastSeenAt).toLocaleString()}</p>}</div>;
