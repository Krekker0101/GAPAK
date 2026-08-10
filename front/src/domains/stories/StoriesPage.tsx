import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import { storiesApi } from './api/storiesApi';
import { StoryBar } from './StoryBar';
import { StoryViewerModal } from './StoryViewerModal';
import { useAuth } from '../auth/AuthContext';
import { PageEmpty, PageError, PageLoading } from '../../pages/common';
import { UserStoryGroup } from '../../shared/types';
import { useToast } from '../../shared/ux/ToastContext';

export const StoriesPage: React.FC = () => {
  const { user } = useAuth();
  const client = useQueryClient();
  const toast = useToast();
  const [viewer, setViewer] = useState<{ group: number; story: number } | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  const query = useInfiniteQuery({
    queryKey: ['stories'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => storiesApi.feed({ cursor: pageParam, limit: 30 }, signal),
    getNextPageParam: last => last.hasMore ? last.nextCursor ?? undefined : undefined,
    staleTime: 20_000,
  });

  const groups = useMemo(() => query.data?.pages.flatMap(p => p.items) ?? [], [query.data]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !query.hasNextPage) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting && !query.isFetchingNextPage) void query.fetchNextPage();
    }, { rootMargin: '500px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [query.hasNextPage, query.isFetchingNextPage, query.fetchNextPage]);

  if (query.isPending) return <PageLoading label="Loading stories…" />;
  if (query.isError) return <PageError error={query.error} onRetry={() => void query.refetch()} />;
  if (!user || !groups.length) return <PageEmpty title="No active stories" description="Stories are server-owned and expire automatically. Check back when people you follow publish new ones." />;

  const openGroup = (group: UserStoryGroup, storyIndex = 0) => {
    const index = groups.findIndex(g => g.user.id === group.user.id);
    setViewer({ group: Math.max(0, index), story: storyIndex });
  };

  const current = viewer ? groups[viewer.group]?.stories[viewer.story] : undefined;

  return <div className="mx-auto max-w-5xl space-y-5">
    <header className="rounded-[var(--radius-3xl)] border border-subtle bg-surface p-6 shadow-token-sm">
      <div className="flex items-center gap-2"><ShieldCheck className="text-indigo-600" size={20} /><h1 className="text-2xl font-bold text-on-brand">Stories</h1></div>
      <p className="mt-1 text-sm text-muted">Ephemeral media is served through backend authorization and expires according to the story policy.</p>
      <div className="mt-5"><StoryBar storyGroups={groups} currentUser={user} onSelectGroup={openGroup} onCreateStoryClick={() => toast.warning('Story publishing requires the backend story-creation contract (POST /api/stories).')} /></div>
    </header>

    <div ref={sentinel} className="h-8 grid place-items-center">{query.isFetchingNextPage && <RefreshCw className="animate-spin text-tertiary" size={18} />}</div>

    {viewer && <StoryViewerModal
      groups={groups}
      initialGroupIndex={viewer.group}
      currentUser={user}
      onClose={() => setViewer(null)}
      onStoryReact={(storyId, emoji) => void storiesApi.react(storyId, emoji, crypto.randomUUID()).then(() => client.invalidateQueries({ queryKey: ['stories'] }))}
      onStoryView={storyId => void storiesApi.markViewed(storyId, crypto.randomUUID()).then(() => client.invalidateQueries({ queryKey: ['stories'] }))}
      onStoryReply={(storyId, text) => void storiesApi.reply(storyId, text, crypto.randomUUID())}
    />}

    {current && <div className="sr-only">Viewing {current.id}</div>}
  </div>;
};
