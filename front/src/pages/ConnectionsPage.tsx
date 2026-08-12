import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ShieldCheck, UserMinus, Users } from 'lucide-react';
import { connectionsApi } from '../domains/connections/api/connectionsApi';
import { Button } from '../shared/design-system/primitives';
import { PageError, PageLoading, PageEmpty } from './common';

const idempotencyKey = () => crypto.randomUUID();

export const ConnectionsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['connections'],
    queryFn: ({ signal }) => connectionsApi.list(signal),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['connections'] });
  const accept = useMutation({
    mutationFn: (connectionId: string) => connectionsApi.accept(connectionId, idempotencyKey()),
    onSuccess: invalidate,
  });
  const trustedCircle = useMutation({
    mutationFn: ({ connectionId, enabled }: { connectionId: string; enabled: boolean }) =>
      connectionsApi.trustedCircle(connectionId, enabled, idempotencyKey()),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (connectionId: string) => connectionsApi.remove(connectionId, idempotencyKey()),
    onSuccess: invalidate,
  });

  if (query.isPending) return <PageLoading label="Loading connections…" />;
  if (query.isError) return <PageError error={query.error} onRetry={() => void query.refetch()} />;

  const connections = query.data ?? [];
  if (!connections.length) {
    return <PageEmpty title="No connections returned" description="The server returned an empty connection graph." />;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="rounded-[var(--radius-3xl)] border border-subtle bg-surface p-6 shadow-token-sm">
        <div className="flex items-center gap-3">
          <Users className="text-indigo-500" />
          <div>
            <h1 className="text-xl font-bold text-primary">Connections</h1>
            <p className="text-sm text-muted">All relationship state is loaded from the GAPAK backend.</p>
          </div>
        </div>
      </header>

      <div className="space-y-3">
        {connections.map((connection) => {
          const isIncoming = connection.status === 'PENDING';
          const isAccepted = connection.status === 'ACCEPTED';
          const busy = accept.isPending || trustedCircle.isPending || remove.isPending;

          return (
            <article
              key={connection.id}
              className="rounded-[var(--radius-2xl)] border border-subtle bg-surface p-4 shadow-token-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-primary">Connection</p>
                  <p className="mt-1 break-all text-xs text-muted">ID: {connection.id}</p>
                  <p className="mt-1 break-all text-xs text-muted">
                    {connection.requesterId} → {connection.addresseeId}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Status: {connection.status} · Created: {connection.createdAt}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {isIncoming && (
                    <Button
                      size="sm"
                      onClick={() => accept.mutate(connection.id)}
                      disabled={busy}
                    >
                      <Check size={15} /> Accept
                    </Button>
                  )}

                  {isAccepted && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => trustedCircle.mutate({
                        connectionId: connection.id,
                        enabled: !connection.trustedByCurrent,
                      })}
                      disabled={busy}
                    >
                      <ShieldCheck size={15} />
                      {connection.trustedByCurrent ? 'Remove Trusted Circle' : 'Add Trusted Circle'}
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => remove.mutate(connection.id)}
                    disabled={busy}
                  >
                    <UserMinus size={15} /> Remove
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};
