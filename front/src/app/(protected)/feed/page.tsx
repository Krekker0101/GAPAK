"use client";

import Link from "next/link";
import { CirclePlus, Clapperboard, Sparkles } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { StateCard } from "@/components/common/state-card";
import { PostCard } from "@/components/feed/post-card";
import { postService } from "@/shared/api/services/post.service";
import { useAsyncResource } from "@/shared/lib/hooks/use-async-resource";
import { Avatar, AvatarFallback } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";

const recommendedPeople = [
  { name: "Lina Park", username: "@lina", followers: "48.2K" },
  { name: "Marco Silva", username: "@marco", followers: "31.7K" },
  { name: "Ada Weiss", username: "@ada", followers: "19.4K" },
  { name: "Kenji Ito", username: "@kenji", followers: "12.8K" },
];

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function Recommendations() {
  return (
    <Card className="sticky top-4 p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Рекомендуемые</h2>
        <Sparkles className="h-4 w-4 text-primary" />
      </div>
      <div className="mt-5 space-y-4">
        {recommendedPeople.map((person) => (
          <div key={person.username} className="flex items-center gap-3">
            <Avatar className="h-11 w-11 rounded-full border border-white/10">
              <AvatarFallback className="rounded-full bg-[linear-gradient(135deg,rgba(138,125,255,0.35),rgba(103,232,249,0.18))] text-xs text-white">
                {initials(person.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{person.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {person.username} · {person.followers}
              </p>
            </div>
            <Button size="sm" variant="outline" className="h-8 px-3">
              Подписаться
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function FeedPage() {
  const { data, isLoading, isError, error, reload } = useAsyncResource(() => postService.getFeed({ page: 1, limit: 20 }), []);

  if (isError) {
    return (
      <StateCard
        title="Лента недоступна"
        description={error?.message ?? "Не удалось загрузить публикации."}
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
    return <StateCard title="Загружаем ленту" description="Собираем свежие публикации." />;
  }

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.025))] p-6 shadow-[0_28px_80px_rgba(0,0,0,0.42)] backdrop-blur-2xl sm:p-8 lg:p-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(138,125,255,0.18),transparent_28%),radial-gradient(circle_at_88%_20%,rgba(103,232,249,0.12),transparent_24%)]" />
        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
          <div className="max-w-3xl space-y-5">
            <p className="text-xs uppercase tracking-[0.28em] text-primary/90">GAPAK</p>
            <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">
              Контролируй свою цифровую жизнь
            </h1>
            <p className="max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              Приватность, контент и общение без компромиссов.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/posts/new">
                  <CirclePlus className="h-4 w-4" />
                  Начать
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/clips">
                  <Clapperboard className="h-4 w-4" />
                  Клипсы
                </Link>
              </Button>
            </div>
          </div>

          <div className="relative hidden min-h-[260px] overflow-hidden rounded-[2rem] border border-white/10 bg-black/30 p-5 lg:block">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_20%,rgba(255,255,255,0.16),transparent_16%),linear-gradient(160deg,rgba(138,125,255,0.3),rgba(8,12,20,0.85)_48%,rgba(103,232,249,0.16))]" />
            <div className="relative flex h-full flex-col justify-between">
              <div className="ml-auto h-16 w-16 rounded-full border border-white/15 bg-white/10 backdrop-blur-xl" />
              <div className="space-y-3">
                <div className="h-3 w-28 rounded-full bg-white/35" />
                <div className="h-3 w-44 rounded-full bg-white/18" />
                <div className="flex gap-2 pt-2">
                  <span className="h-9 w-9 rounded-full bg-white/20" />
                  <span className="h-9 w-9 rounded-full bg-white/12" />
                  <span className="h-9 w-9 rounded-full bg-white/12" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          {data.length === 0 ? (
            <EmptyState
              title="Пока пусто"
              description="Создайте первую публикацию."
              action={
                <Button asChild>
                  <Link href="/posts/new">Создать</Link>
                </Button>
              }
            />
          ) : (
            data.map((post) => <PostCard key={post.id} post={post} />)
          )}
        </div>

        <aside className="hidden xl:block">
          <Recommendations />
        </aside>
      </div>
    </div>
  );
}
