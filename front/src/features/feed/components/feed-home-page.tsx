"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { EmptyState } from "@/components/common/empty-state";
import { StateCard } from "@/components/common/state-card";
import { PostCard } from "@/components/feed/post-card";
import { loadHomeDashboard } from "@/features/feed/api/home-dashboard.service";
import { DashboardAside } from "@/features/feed/components/dashboard-panels";
import { FeedOverview } from "@/features/feed/components/feed-overview";
import { FeedSkeleton } from "@/features/feed/components/feed-skeleton";
import { QuickComposer } from "@/features/feed/components/quick-composer";
import { StoriesRail } from "@/features/feed/components/stories-rail";
import { TemporaryRoomPanel } from "@/features/feed/components/temporary-room-panel";
import { useInfiniteFeed } from "@/features/feed/hooks/use-infinite-feed";
import type { HomeDashboardViewModel } from "@/features/feed/types/home-dashboard";
import { useAsyncResource } from "@/shared/lib/hooks/use-async-resource";
import type { TrustRoomResponse } from "@/shared/types/room";
import { Button } from "@/shared/ui/button";

export function FeedHomePage() {
  const { data, isLoading, isError, error, reload } = useAsyncResource(loadHomeDashboard, []);
  const { posts, loadingMore, hasMore, loadMoreRef } = useInfiniteFeed(data?.posts);
  const [rooms, setRooms] = useState<TrustRoomResponse[]>([]);

  useEffect(() => {
    if (data) {
      setRooms(data.rooms);
    }
  }, [data]);

  if (isError) {
    return (
      <StateCard
        title="Главная страница недоступна"
        description={error?.message ?? "Backend API не вернул данные для главной страницы."}
        variant="error"
        action={
          <Button onClick={() => void reload()} variant="outline">
            Повторить
          </Button>
        }
      />
    );
  }

  if (isLoading || !data) {
    return <FeedSkeleton />;
  }

  const dashboard: HomeDashboardViewModel = { ...data, posts, rooms };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,680px)_360px] xl:justify-center 2xl:grid-cols-[minmax(0,720px)_380px]">
      <div className="min-w-0 space-y-5">
        <FeedOverview dashboard={dashboard} />
        <StoriesRail profile={data.profile} stories={data.stories} />
        <QuickComposer profile={data.profile} />
        <TemporaryRoomPanel onCreated={(room) => setRooms((current) => [room, ...current])} />

        <div className="space-y-4">
          {posts.length === 0 ? (
            <EmptyState
              title="В backend пока нет публикаций"
              description="Создайте первую публикацию — она появится в этой ленте без статических примеров."
              action={
                <Button asChild>
                  <Link href="/posts/new">Создать</Link>
                </Button>
              }
            />
          ) : (
            posts.map((post) => <PostCard key={post.id} post={post} />)
          )}
          <div ref={loadMoreRef} className="py-4 text-center text-sm text-muted-foreground">
            {loadingMore ? "Загружаем ещё через API…" : hasMore ? "Прокрутите ниже для продолжения" : "Все доступные публикации загружены"}
          </div>
        </div>
      </div>

      <DashboardAside dashboard={dashboard} />
    </div>
  );
}
