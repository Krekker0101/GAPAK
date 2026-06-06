"use client";

import Link from "next/link";
import { CirclePlus, Play } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { StateCard } from "@/components/common/state-card";
import { PostCard } from "@/components/feed/post-card";
import { postService } from "@/shared/api/services/post.service";
import { useAsyncResource } from "@/shared/lib/hooks/use-async-resource";
import { Button } from "@/shared/ui/button";

export default function ClipsPage() {
  const { data, isLoading, isError, error, reload } = useAsyncResource(() => postService.getClips({ page: 1, limit: 20 }), []);

  if (isError) {
    return (
      <StateCard
        title="Клипсы недоступны"
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
    return <StateCard title="Загружаем клипсы" description="Готовим видео." />;
  }

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-2xl sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.28em] text-primary/90">Клипсы</p>
          <h1 className="font-display text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl">Видео в фокусе</h1>
          <p className="max-w-xl text-sm leading-6 text-muted-foreground">Вертикальный поток без лишнего шума.</p>
        </div>
        <Button asChild>
          <Link href="/posts/new">
            <CirclePlus className="h-4 w-4" />
            Новый клипс
          </Link>
        </Button>
      </section>

      {data.length === 0 ? (
        <EmptyState
          title="Клипсов пока нет"
          description="Создайте первый короткий ролик."
          action={
            <Button asChild>
              <Link href="/posts/new">
                <Play className="h-4 w-4" />
                Создать
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
          {data.map((post) => (
            <PostCard key={post.id} post={post} mode="clip" />
          ))}
        </div>
      )}
    </div>
  );
}
