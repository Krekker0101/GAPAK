"use client";

import Link from "next/link";
import { AlertTriangle, CirclePlus, Clapperboard, ShieldCheck, Sparkles } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { MetricCard } from "@/components/common/metric-card";
import { PageHeader } from "@/components/common/page-header";
import { StateCard } from "@/components/common/state-card";
import { PostCard } from "@/components/feed/post-card";
import { useAsyncResource } from "@/shared/lib/hooks/use-async-resource";
import { postService } from "@/shared/api/services/post.service";
import { securityService } from "@/shared/api/services/security.service";
import { userService } from "@/shared/api/services/user.service";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";

export default function FeedPage() {
  const { data, isLoading, isError, error, reload } = useAsyncResource(async () => {
    const [profile, posts, flags] = await Promise.all([userService.getMe(), postService.getFeed({ page: 1, limit: 20 }), securityService.getFlags()]);
    return { profile, posts, flags };
  }, []);

  if (isError) {
    return (
      <StateCard
        title="Unable to load the feed"
        description={error?.message ?? "The feed request failed."}
        variant="error"
        action={
          <Button onClick={() => void reload()} variant="outline">
            Retry
          </Button>
        }
      />
    );
  }

  if (isLoading || !data) {
    return <StateCard title="Loading your feed" description="Restoring identity-aware posts and the current privacy posture." />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Главная"
        title="Живое пространство, где контент ощущается как премиум-событие"
        description="Минимум текста, максимум визуального восприятия и ощущение, что ты открыл новый уровень социальной сети."
        actions={
          <Button asChild>
            <Link href="/posts/new">
              <CirclePlus className="h-4 w-4" />
              Создать
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1.45fr_0.55fr]">
        <div className="space-y-4">
          <Card className="relative overflow-hidden p-6">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(102,244,255,0.16),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(255,178,244,0.14),_transparent_30%)]" />
            <div className="relative grid gap-5 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
              <div className="space-y-4">
                <p className="text-[11px] uppercase tracking-[0.28em] text-primary">Быстрый старт</p>
                <h2 className="font-display text-3xl font-semibold">Кино-поток вместо скучной ленты.</h2>
                <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
                  Создавайте посты и клипсы в одной визуальной системе: мягкие панели, живые обводки, приглушённые световые акценты.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button asChild variant="outline">
                    <Link href="/posts/new">
                      <CirclePlus className="h-4 w-4" />
                      Публикация
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/clips">
                      <Clapperboard className="h-4 w-4" />
                      Смотреть клипсы
                    </Link>
                  </Button>
                </div>
              </div>
              <div className="rounded-[1.5rem] border border-white/8 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Live deck</span>
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div className="mt-4 space-y-3">
                  <div className="rounded-[1.2rem] bg-gradient-to-br from-cyan-300/20 via-transparent to-fuchsia-300/15 p-4">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Visual mood</p>
                    <p className="mt-2 font-display text-lg font-semibold">Cinematic feed</p>
                  </div>
                  <div className="rounded-[1.2rem] border border-white/8 p-4">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Signals</p>
                    <p className="mt-2 text-sm text-muted-foreground">{data.flags.length} активных сигналов безопасности</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {data.posts.length === 0 ? (
            <EmptyState
              title="Пока ничего нет"
              description="Создайте первую публикацию или клипс, чтобы оживить ленту."
              action={
                <Button asChild>
                  <Link href="/posts/new">Создать первую публикацию</Link>
                </Button>
              }
            />
          ) : (
            <div className="space-y-4">
              {data.posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="grid gap-4">
            <MetricCard
              label="Приватность"
              value={data.profile.privacy.postDefaultPrivacy}
              detail="Ваш стандартный режим видимости для новых публикаций."
              icon={<ShieldCheck className="h-5 w-5 text-primary" />}
            />
            <MetricCard
              label="Сигналы риска"
              value={String(data.flags.length)}
              detail="Безопасность рядом с лентой, чтобы важное не терялось."
              icon={<AlertTriangle className="h-5 w-5 text-amber-200" />}
            />
          </div>

          <Card className="p-6">
            <p className="text-[11px] uppercase tracking-[0.24em] text-primary">Кто что видит</p>
            <h3 className="mt-4 font-display text-2xl font-semibold">Профиль и приватность</h3>
            <div className="mt-5 grid gap-3 text-sm text-muted-foreground">
              <div className="rounded-[1.25rem] border border-white/8 bg-white/[0.03] p-4">
                <p className="font-medium text-foreground">Видимость профиля</p>
                <p className="mt-1">{data.profile.privacy.profileVisibility}</p>
              </div>
              <div className="rounded-[1.25rem] border border-white/8 bg-white/[0.03] p-4">
                <p className="font-medium text-foreground">Последний онлайн</p>
                <p className="mt-1">{data.profile.privacy.lastSeenVisibility}</p>
              </div>
              <div className="rounded-[1.25rem] border border-white/8 bg-white/[0.03] p-4">
                <p className="font-medium text-foreground">Онлайн-статус</p>
                <p className="mt-1">{data.profile.privacy.showOnlineStatus ? "Виден разрешенным людям" : "Скрыт"}</p>
              </div>
            </div>
            <Button asChild variant="outline" className="mt-5 w-full">
              <Link href="/settings/privacy">Настроить приватность</Link>
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
