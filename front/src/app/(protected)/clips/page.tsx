"use client";

import Link from "next/link";
import { CirclePlus, Clapperboard, ShieldCheck, Wifi } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { StateCard } from "@/components/common/state-card";
import { PostCard } from "@/components/feed/post-card";
import { postService } from "@/shared/api/services/post.service";
import { useAsyncResource } from "@/shared/lib/hooks/use-async-resource";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";

export default function ClipsPage() {
  const { data, isLoading, isError, error, reload } = useAsyncResource(() => postService.getClips({ page: 1, limit: 20 }), []);

  if (isError) {
    return (
      <StateCard
        title="Не удалось загрузить клипсы"
        description={error?.message ?? "Попробуйте еще раз."}
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
    return <StateCard title="Загружаем клипсы" description="Подбираем видео и безопасные playback-ссылки." />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Клипс"
        title="Короткие видео без лишней сложности"
        description="Загружайте видео, а сервер подготовит качества для разных скоростей интернета и отдаст воспроизведение через безопасные grants."
        actions={
          <Button asChild>
            <Link href="/posts/new">
              <CirclePlus className="h-4 w-4" />
              Новый клипс
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {data.length === 0 ? (
            <EmptyState
              title="Клипсов пока нет"
              description="Создайте первый клипс: видео загрузится безопасно, а backend подготовит адаптивные качества."
              action={
                <Button asChild>
                  <Link href="/posts/new">Создать клипс</Link>
                </Button>
              }
            />
          ) : (
            data.map((post) => <PostCard key={post.id} post={post} />)
          )}
        </div>

        <Card className="h-fit p-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Clapperboard className="h-5 w-5" />
          </div>
          <h2 className="mt-5 font-display text-2xl font-semibold">Как работает качество</h2>
          <div className="mt-4 space-y-3 text-sm leading-7 text-muted-foreground">
            <p className="flex gap-2">
              <Wifi className="mt-1 h-4 w-4 shrink-0 text-primary" />
              Плеер выбирает подходящее качество по скорости соединения.
            </p>
            <p className="flex gap-2">
              <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-primary" />
              Приватные storage paths не раскрываются, воспроизведение идет через короткоживущие ссылки.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
