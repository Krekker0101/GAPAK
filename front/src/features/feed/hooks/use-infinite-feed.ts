"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { postService } from "@/shared/api/services/post.service";
import type { PostResponse } from "@/shared/types/post";
import { FEED_PAGE_SIZE } from "@/features/feed/types/home-dashboard";

export function useInfiniteFeed(initialPosts: PostResponse[] | null | undefined) {
  const [posts, setPosts] = useState<PostResponse[]>([]);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!initialPosts) {
      return;
    }

    setPosts(initialPosts);
    setPage(1);
    setHasMore(initialPosts.length === FEED_PAGE_SIZE);
  }, [initialPosts]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) {
      return;
    }

    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const nextPosts = await postService.getFeed({ page: nextPage, limit: FEED_PAGE_SIZE });
      setPosts((current) => [...current, ...nextPosts]);
      setPage(nextPage);
      setHasMore(nextPosts.length === FEED_PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, page]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMore();
        }
      },
      { rootMargin: "600px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore]);

  return {
    posts,
    setPosts,
    loadingMore,
    hasMore,
    loadMoreRef,
  };
}
