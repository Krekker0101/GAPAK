import React, { useEffect, useMemo, useRef } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { FeedView } from '../domains/feed/FeedView';
import { CreatePostRequest, postsApi } from '../domains/posts/api/postsApi';
import { useAuth } from '../domains/auth/AuthContext';
import { PageError, PageLoading } from './common';
import { useNavigate } from 'react-router-dom';
import { storiesApi } from '../domains/stories/api/storiesApi';
import { StoryComposerModal } from '../domains/stories/StoryComposerModal';
import { useToast } from '../shared/ux/ToastContext';
import type { Post, Story } from '../shared/api/backendContracts';
import { idempotencyKey } from '../shared/ux/idempotencyKey';
import { RecommendationsPanel } from '../domains/connections/RecommendationsPanel';

export const FeedPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [composerOpen, setComposerOpen] = React.useState(false);

  const feed = useInfiniteQuery({
    queryKey: ['posts', 'feed'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => postsApi.feed({ cursor: pageParam, limit: 20 }, signal),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const posts = useMemo(() => {
    const seen = new Set<string>();
    // The backend can include a null/malformed entry in a feed page (e.g. a
    // post whose author lookup failed server-side), which previously crashed
    // this hook with "Cannot read properties of null (reading 'id')" as soon
    // as it hit `post.id` below. Drop those before dedup.
    return (feed.data?.pages.flatMap((p) => p.items) ?? [])
      .filter((post): post is Post => Boolean(post && post.id))
      .filter((post) => {
        if (seen.has(post.id)) return false;
        seen.add(post.id);
        return true;
      });
  }, [feed.data]);

  const stories = useQuery({ queryKey: ['stories', 'feed-preview'], queryFn: ({ signal }) => storiesApi.feed({ limit: 20 }, signal), staleTime: 20_000 });
  const visibleStories: Story[] = (stories.data ?? []).filter((story) => story.status === 'ACTIVE');

  const likeMutation = useMutation({
    mutationFn: async ({ postId, liked }: { postId: string; liked: boolean }) => {
      return liked ? postsApi.like(postId, idempotencyKey()) : postsApi.unlike(postId, idempotencyKey());
    },
    onMutate: async ({ postId, liked }) => {
      await queryClient.cancelQueries({ queryKey: ['posts', 'feed'] });
      const previous = queryClient.getQueryData<InfiniteData<Awaited<ReturnType<typeof postsApi.feed>>>>(['posts', 'feed']);
      queryClient.setQueryData<InfiniteData<Awaited<ReturnType<typeof postsApi.feed>>>>(['posts', 'feed'], (data) => {
        if (!data) return data;
        return {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.map((post) => post.id === postId
              ? { ...post, isLiked: liked, likeCount: Math.max(0, post.likeCount + (liked ? 1 : -1)) }
              : post),
          })),
        };
      });
      return { previous };
    },
    onError: (error, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['posts', 'feed'], ctx.previous);
      toast.error(error instanceof Error ? error.message : 'Unable to update like');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['posts', 'feed'] }),
  });

  const commentMutation = useMutation({
    mutationFn: ({ postId, text, parentId }: { postId: string; text: string; parentId?: string }) =>
      postsApi.comment(postId, { content: text, parentCommentId: parentId }, idempotencyKey()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['posts', 'feed'] }),
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Unable to create comment'),
  });

  const createPost = useMutation({
    mutationFn: (post: CreatePostRequest) => postsApi.create(post, idempotencyKey()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['posts', 'feed'] }),
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Unable to create post'),
  });

  const deletePost = useMutation({
    mutationFn: (postId: string) => postsApi.remove(postId, idempotencyKey()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['posts', 'feed'] }),
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Unable to delete post'),
  });

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !feed.hasNextPage) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && !feed.isFetchingNextPage) void feed.fetchNextPage();
    }, { rootMargin: '500px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [feed.hasNextPage, feed.isFetchingNextPage, feed.fetchNextPage]);

  if (!user) return <PageLoading label="Restoring session…" />;
  if (feed.isPending) return <PageLoading label="Loading feed…" />;
  if (feed.isError) return <PageError error={feed.error} onRetry={() => void feed.refetch()} />;

  return <div>
    <div className="flex items-start gap-6 max-w-6xl mx-auto">
      <div className="flex-1 min-w-0">
        <FeedView
          currentUser={user}
          posts={posts}
          stories={visibleStories}
          onLikeToggle={(postId) => {
            const post = posts.find((p) => p.id === postId);
            if (post) likeMutation.mutate({ postId, liked: !post.isLiked });
          }}
          onAddComment={(postId, text, parentId) => commentMutation.mutate({ postId, text, parentId })}
          onCreatePost={(post) => createPost.mutateAsync(post)}
          onCreateStory={() => setComposerOpen(true)}
          onUserClick={(userId) => navigate(`/users/${encodeURIComponent(userId)}`)}
          onStoryReact={(storyId, reaction) => void storiesApi.react(storyId, reaction, idempotencyKey()).then(() => stories.refetch()).catch((error) => toast.error(error instanceof Error ? error.message : 'Unable to react to story'))}
          onDeletePost={(postId) => deletePost.mutate(postId)}
          onRefresh={() => { void feed.refetch(); }}
          isRefreshing={feed.isRefetching}
        />
        <div ref={loadMoreRef} className="h-12 grid place-items-center text-xs text-tertiary">
          {feed.isFetchingNextPage ? 'Loading more…' : feed.hasNextPage ? 'Scroll for more' : 'You reached the end'}
        </div>
      </div>
      <RecommendationsPanel />
    </div>
    {composerOpen && <StoryComposerModal currentUser={user} onClose={() => setComposerOpen(false)} onStoryCreated={async input => { await storiesApi.create(input, idempotencyKey()); await stories.refetch(); }} />}
  </div>;
};
