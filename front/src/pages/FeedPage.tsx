import React, { useEffect, useMemo, useRef } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FeedView } from '../domains/feed/FeedView';
import { postsApi } from '../domains/posts/api/postsApi';
import { useAuth } from '../domains/auth/AuthContext';
import { PageError, PageLoading } from './common';
import { Post } from '../shared/types/social';
import { useNavigate } from 'react-router-dom';

const idempotencyKey = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

export const FeedPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const feed = useInfiniteQuery({
    queryKey: ['posts', 'feed'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => postsApi.feed({ cursor: pageParam, limit: 20 }, signal),
    getNextPageParam: (last) => last.hasMore === false ? undefined : last.nextCursor ?? undefined,
  });
  const posts = useMemo(() => feed.data?.pages.flatMap((p) => p.items) ?? [], [feed.data]);
  const storyGroups = []; // Story backend contract is not yet approved; never fabricate story data.

  const likeMutation = useMutation({
    mutationFn: async ({ postId, liked }: { postId: string; liked: boolean }) => liked ? postsApi.like(postId, idempotencyKey()) : postsApi.unlike(postId),
    onMutate: async ({ postId, liked }) => {
      await queryClient.cancelQueries({ queryKey: ['posts', 'feed'] });
      const previous = queryClient.getQueryData(['posts', 'feed']);
      queryClient.setQueriesData({ queryKey: ['posts', 'feed'] }, (data: any) => {
        if (!data?.pages) return data;
        return { ...data, pages: data.pages.map((page: any) => ({ ...page, items: page.items.map((post: Post) => post.id === postId ? { ...post, likedByMe: liked, likesCount: Math.max(0, post.likesCount + (liked ? 1 : -1)) } : post) })) };
      });
      return { previous };
    },
    onError: (_err, _vars, ctx) => { if (ctx?.previous) queryClient.setQueryData(['posts', 'feed'], ctx.previous); },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['posts', 'feed'] }),
  });

  const commentMutation = useMutation({
    mutationFn: ({ postId, text, parentId }: { postId: string; text: string; parentId?: string }) => postsApi.comment(postId, { body: text, parentId }, idempotencyKey()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['posts', 'feed'] }),
  });
  const createPost = useMutation({
    mutationFn: (post: Partial<Post>) => postsApi.create(post, idempotencyKey()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['posts', 'feed'] }),
  });

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !feed.hasNextPage) return;
    const observer = new IntersectionObserver((entries) => { if (entries[0]?.isIntersecting && !feed.isFetchingNextPage) void feed.fetchNextPage(); }, { rootMargin: '500px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [feed.hasNextPage, feed.isFetchingNextPage, feed.fetchNextPage]);

  if (!user) return <PageLoading label="Restoring session…" />;
  if (feed.isPending) return <PageLoading label="Loading feed…" />;
  if (feed.isError) return <PageError error={feed.error} onRetry={() => void feed.refetch()} />;

  return <div>
    <FeedView
      currentUser={user}
      posts={posts}
      storyGroups={storyGroups}
      onLikeToggle={(postId) => { const post = posts.find((p) => p.id === postId); if (post) likeMutation.mutate({ postId, liked: !post.likedByMe }); }}
      onAddComment={(postId, text, parentId) => commentMutation.mutate({ postId, text, parentId })}
      onCreatePost={(post) => createPost.mutateAsync(post)}
      onCreateStory={() => undefined}
      onUserClick={(userId) => navigate(`/users/${encodeURIComponent(userId)}`)}
      onStoryReact={() => undefined}
      onRefresh={() => { void feed.refetch(); }}
      isRefreshing={feed.isRefetching}
    />
    <div ref={loadMoreRef} className="h-12 grid place-items-center text-xs text-tertiary">{feed.isFetchingNextPage ? 'Loading more…' : feed.hasNextPage ? 'Scroll for more' : 'You reached the end'}</div>
  </div>;
};
