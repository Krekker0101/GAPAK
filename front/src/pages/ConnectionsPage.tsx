import React from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, UserPlus, UserX, Users } from 'lucide-react';
import { connectionsApi } from '../domains/connections/api/connectionsApi';
import { useNavigate } from 'react-router-dom';
import { Avatar, Button } from '../shared/design-system/primitives';
import { PageError, PageLoading, PageEmpty } from './common';

const key = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

export const ConnectionsPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const query = useInfiniteQuery({ queryKey: ['connections'], initialPageParam: undefined as string | undefined, queryFn: ({ pageParam, signal }) => connectionsApi.list({ cursor: pageParam, limit: 30 }, signal), getNextPageParam: (last) => last.nextCursor ?? undefined });
  const requests = query.data?.pages.flatMap((p) => p.items) ?? [];
  const accept = useMutation({ mutationFn: (id: string) => connectionsApi.accept(id, key()), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['connections'] }) });
  const reject = useMutation({ mutationFn: (id: string) => connectionsApi.reject(id, key()), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['connections'] }) });
  const remove = useMutation({ mutationFn: (id: string) => connectionsApi.remove(id, key()), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['connections'] }) });

  if (query.isPending) return <PageLoading label="Loading connections…" />;
  if (query.isError) return <PageError error={query.error} onRetry={() => void query.refetch()} />;
  if (!requests.length) return <PageEmpty title="No connections returned" description="The server returned an empty connection graph." />;

  return <div className="mx-auto max-w-4xl space-y-5">
    <header className="rounded-[var(--radius-3xl)] border border-subtle bg-surface p-6 shadow-token-sm"><div className="flex items-center gap-3"><Users className="text-indigo-500" /><div><h1 className="text-xl font-bold text-primary">Connections</h1><p className="text-sm text-muted">Server-sourced relationship graph and requests.</p></div></div></header>
    <div className="space-y-3">{requests.map((req) => { const person = req.sender?.id ? req.sender : req.receiver; return <article key={req.id} className="rounded-[var(--radius-2xl)] border border-subtle bg-surface p-4 shadow-token-sm flex items-center justify-between gap-4"><button className="flex items-center gap-3 min-w-0 text-left" onClick={() => navigate(`/users/${encodeURIComponent(person.id)}`)}><Avatar src={person.avatarUrl} name={person.displayName} size="md" /><span className="min-w-0"><strong className="block truncate text-sm text-primary">{person.displayName}</strong><span className="block truncate text-xs text-muted">@{person.username}</span></span></button><div className="flex items-center gap-2">{req.status === 'pending' ? <><Button size="sm" onClick={() => accept.mutate(req.id)} disabled={accept.isPending}><Check size={15} /> Accept</Button><Button size="sm" variant="outline" onClick={() => reject.mutate(req.id)} disabled={reject.isPending}><UserX size={15} /> Decline</Button></> : <Button size="sm" variant="outline" onClick={() => remove.mutate(person.id)} disabled={remove.isPending}><UserX size={15} /> Remove</Button>}</div></article>})}</div>
  </div>;
};
