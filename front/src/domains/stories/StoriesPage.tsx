import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { storiesApi } from './api/storiesApi';
import { StoryBar } from './StoryBar';
import { StoryViewerModal } from './StoryViewerModal';
import { StoryComposerModal } from './StoryComposerModal';
import { useAuth } from '../auth/AuthContext';
import { PageEmpty, PageError, PageLoading } from '../../pages/common';
import type { Story } from '../../shared/api/backendContracts';
import { idempotencyKey } from '../../shared/ux/idempotencyKey';

export const StoriesPage: React.FC = () => {
  const { user } = useAuth();
  const client = useQueryClient();
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);

  const query = useQuery({
    queryKey: ['stories', 'feed'],
    queryFn: ({ signal }) => storiesApi.feed({ page: 1, limit: 50 }, signal),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const stories = useMemo(() => (query.data ?? []).filter(story => story.status === 'ACTIVE'), [query.data]);
  const selectedStory = stories.find(story => story.id === selectedStoryId);

  useEffect(() => {
    if (!selectedStoryId || selectedStory) return;
    setSelectedStoryId(null);
  }, [selectedStoryId, selectedStory]);

  if (!user) return <PageLoading label="Restoring session…" />;
  if (query.isPending) return <PageLoading label="Loading stories…" />;
  if (query.isError) return <PageError error={query.error} onRetry={() => void query.refetch()} />;

  const refresh = () => void client.invalidateQueries({ queryKey: ['stories', 'feed'] });

  return <div className="mx-auto max-w-5xl space-y-5">
    <header className="rounded-[var(--radius-3xl)] border border-subtle bg-surface p-6 shadow-token-sm">
      <div className="flex items-center gap-2"><ShieldCheck className="text-indigo-600" size={20} /><h1 className="text-2xl font-bold text-primary">Stories</h1></div>
      <p className="mt-1 text-sm text-muted">The backend decides visibility, view state, timestamps, and expiration.</p>
      <div className="mt-5"><StoryBar stories={stories} currentUser={user} onSelectStory={setSelectedStoryId} onCreateStoryClick={() => setComposerOpen(true)} /></div>
    </header>
    {!stories.length && <PageEmpty title="No active stories" description="The server returned no active stories." />}
    {query.isFetching && <div className="flex items-center justify-center gap-2 text-xs text-muted"><RefreshCw size={14} className="animate-spin" />Refreshing server state…</div>}

    {selectedStory && <StoryViewerModal
      story={selectedStory}
      currentUser={user}
      onClose={() => setSelectedStoryId(null)}
      onChanged={refresh}
    />}

    {composerOpen && <StoryComposerModal
      currentUser={user}
      onClose={() => setComposerOpen(false)}
      onStoryCreated={async input => { await storiesApi.create(input, idempotencyKey()); refresh(); }}
    />}
  </div>;
};
