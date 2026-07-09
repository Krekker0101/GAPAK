"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Bot,
  CirclePlus,
  Eye,
  Flame,
  LockKeyhole,
  MessageSquare,
  Radar,
  ShieldCheck,
  Sparkles,
  Timer,
  Upload,
  Users,
  Zap,
} from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { StateCard } from "@/components/common/state-card";
import { PostCard } from "@/components/feed/post-card";
import { mediaService } from "@/shared/api/services/media.service";
import { postService } from "@/shared/api/services/post.service";
import { storyService } from "@/shared/api/services/story.service";
import { chatService } from "@/shared/api/services/chat.service";
import { connectionService } from "@/shared/api/services/connection.service";
import { roomService } from "@/shared/api/services/room.service";
import { securityService } from "@/shared/api/services/security.service";
import { sessionService } from "@/shared/api/services/session.service";
import { userService } from "@/shared/api/services/user.service";
import { formatRelativeTime } from "@/shared/lib/utils";
import { useAsyncResource } from "@/shared/lib/hooks/use-async-resource";
import type { StoryResponse } from "@/shared/types/story";
import { Avatar, AvatarFallback } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";

type FeedDashboard = Awaited<ReturnType<typeof loadDashboard>>;

function compactId(value: string) {
  return value.length > 10 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

async function loadDashboard() {
  const [profile, posts, stories, chats, connections, rooms, sessions, flags, alerts, auditEvents] = await Promise.all([
    userService.getMe(),
    postService.getFeed({ page: 1, limit: 20 }),
    storyService.getFeed({ page: 1, limit: 30 }),
    chatService.listChats(),
    connectionService.listConnections(),
    roomService.listRooms(),
    sessionService.listSessions(),
    securityService.getFlags(),
    securityService.getAlerts(),
    securityService.getAuditEvents(),
  ]);

  return { profile, posts, stories, chats, connections, rooms, sessions, flags, alerts, auditEvents };
}

function StoryRail({ dashboard, onReload }: { dashboard: FeedDashboard; onReload: () => void }) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedStory, setSelectedStory] = useState<StoryResponse | null>(null);
  const [viewerCount, setViewerCount] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [storyError, setStoryError] = useState<string | null>(null);

  const orderedStories = useMemo(() => {
    const own = dashboard.stories.filter((story) => story.authorId === dashboard.profile.id);
    const others = dashboard.stories.filter((story) => story.authorId !== dashboard.profile.id);
    return [...own, ...others];
  }, [dashboard.profile.id, dashboard.stories]);

  async function openStory(story: StoryResponse) {
    setSelectedStory(story);
    setViewerCount(null);
    setStoryError(null);
    try {
      const [fresh, viewers] = await Promise.all([storyService.getById(story.id), storyService.getViewers(story.id)]);
      setSelectedStory(fresh);
      setViewerCount(viewers.length);
    } catch (error) {
      setStoryError(error instanceof Error ? error.message : "Не удалось открыть историю.");
    }
  }

  async function reactToStory(reactionType: "LIKE" | "FIRE" | "SUPPORT") {
    if (!selectedStory) {
      return;
    }
    await storyService.react(selectedStory.id, { reactionType });
  }

  async function handleStoryFile(file: File | null) {
    if (!file) {
      return;
    }

    setIsUploading(true);
    setStoryError(null);
    try {
      const upload = await mediaService.uploadFile(file, "STORY");
      await storyService.create({
        mediaFileId: upload.mediaFileId,
        caption: null,
        privacy: "PUBLIC",
        allowReplies: true,
        allowReactions: true,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
      onReload();
    } catch (error) {
      setStoryError(error instanceof Error ? error.message : "Не удалось загрузить историю.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <Card className="social-card relative overflow-hidden p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-primary/90">Истории</p>
          <h2 className="font-display text-xl font-semibold">Живой верх ленты</h2>
        </div>
        <Button type="button" variant="outline" size="sm" disabled={isUploading} onClick={() => fileInputRef.current?.click()}>
          <Upload className="h-4 w-4" />
          {isUploading ? "Загрузка" : "Моя история"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={(event) => void handleStoryFile(event.target.files?.[0] ?? null)}
        />
      </div>

      {storyError ? <p className="mb-3 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-2 text-sm text-rose-200">{storyError}</p> : null}

      {orderedStories.length === 0 ? (
        <p className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-muted-foreground">
          Истории появятся здесь сразу после публикации через API.
        </p>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {orderedStories.map((story) => {
            const own = story.authorId === dashboard.profile.id;
            return (
              <button key={story.id} type="button" onClick={() => void openStory(story)} className="group min-w-[88px] text-left">
                <span className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[conic-gradient(from_180deg,rgba(102,244,255,0.95),rgba(138,125,255,0.95),rgba(255,178,244,0.9),rgba(102,244,255,0.95))] p-[2px] shadow-[0_0_28px_rgba(102,244,255,0.22)] transition group-hover:scale-105">
                  <Avatar className="h-full w-full border-2 border-background">
                    <AvatarFallback className="bg-background text-xs text-foreground">{own ? initials(dashboard.profile.displayName) : compactId(story.authorId).slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="absolute bottom-1 right-1 h-3 w-3 rounded-full border-2 border-background bg-emerald-400" />
                </span>
                <span className="mt-2 block truncate text-center text-xs text-muted-foreground">{own ? "Моя" : compactId(story.authorId)}</span>
              </button>
            );
          })}
        </div>
      )}

      {selectedStory ? (
        <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">История {compactId(selectedStory.id)}</p>
              <p className="text-xs text-muted-foreground">{formatRelativeTime(selectedStory.publishedAt)} · просмотров: {viewerCount ?? selectedStory.viewerCount}</p>
            </div>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => void reactToStory("LIKE")}>Like</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => void reactToStory("FIRE")}><Flame className="h-4 w-4" /></Button>
              <Button type="button" size="sm" variant="outline" onClick={() => void reactToStory("SUPPORT")}>Support</Button>
            </div>
          </div>
          {selectedStory.caption ? <p className="mt-3 text-sm text-foreground/90">{selectedStory.caption}</p> : null}
        </div>
      ) : null}
    </Card>
  );
}

function ComposerCard({ profile }: { profile: FeedDashboard["profile"] }) {
  return (
    <Card className="social-card relative overflow-hidden p-5">
      <div className="flex items-center gap-4">
        <Avatar className="h-12 w-12 border border-white/10">
          <AvatarFallback>{initials(profile.displayName)}</AvatarFallback>
        </Avatar>
        <Button asChild variant="outline" className="h-12 flex-1 justify-start rounded-full px-5 text-muted-foreground">
          <Link href="/posts/new">Создать защищенную публикацию</Link>
        </Button>
        <Button asChild size="icon" className="h-12 w-12 rounded-full">
          <Link href="/posts/new" aria-label="Create post"><CirclePlus className="h-5 w-5" /></Link>
        </Button>
      </div>
      <div className="mt-4 grid gap-3 text-xs text-muted-foreground sm:grid-cols-3">
        <span className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2"><Timer className="mr-2 inline h-3.5 w-3.5 text-primary" />Таймер доступа</span>
        <span className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2"><LockKeyhole className="mr-2 inline h-3.5 w-3.5 text-primary" />Приватная аудитория</span>
        <span className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2"><ShieldCheck className="mr-2 inline h-3.5 w-3.5 text-primary" />Trust-first постинг</span>
      </div>
    </Card>
  );
}

function TemporaryRooms({ rooms }: { rooms: FeedDashboard["rooms"] }) {
  return (
    <Card className="social-card relative overflow-hidden p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-primary/90">Комнаты</p>
          <h2 className="font-display text-lg font-semibold">Временные комнаты</h2>
        </div>
        <Button asChild size="sm" variant="outline"><Link href="/rooms">Управлять</Link></Button>
      </div>
      {rooms.length === 0 ? (
        <p className="text-sm text-muted-foreground">Активные комнаты из Backend API появятся после создания.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          {rooms.slice(0, 3).map((room) => (
            <Link key={room.id} href="/rooms" className="rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-4 transition hover:border-primary/30 hover:bg-white/[0.07]">
              <p className="truncate text-sm font-semibold">{room.name}</p>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{room.description || room.accessMode}</p>
              <p className="mt-3 text-xs text-primary">Retention: {room.messageRetentionDays ? `${room.messageRetentionDays} дн.` : "по правилам комнаты"}</p>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

function RightPanel({ dashboard }: { dashboard: FeedDashboard }) {
  const currentSession = dashboard.sessions.find((session) => session.isCurrent);
  const securityLevel = currentSession?.securityLevel ?? (dashboard.profile.twoFactorEnabled ? "2FA" : "BASE");
  const activityItems = [
    { label: "Чаты", value: dashboard.chats.length, icon: MessageSquare },
    { label: "Связи", value: dashboard.connections.length, icon: Users },
    { label: "Реакции", value: dashboard.posts.reduce((total, post) => total + post.likeCount, 0), icon: Activity },
    { label: "Просмотры историй", value: dashboard.stories.reduce((total, story) => total + story.viewerCount, 0), icon: Eye },
  ];
  const recommendationItems = [
    ...dashboard.rooms.slice(0, 2).map((room) => ({ title: room.name, detail: room.accessMode, href: "/rooms" })),
    ...dashboard.connections.slice(0, 2).map((connection) => ({ title: `Связь ${compactId(connection.id)}`, detail: connection.status, href: "/profile" })),
  ];

  return (
    <aside className="sticky top-4 space-y-4">
      <Card className="social-card relative overflow-hidden p-5">
        <div className="flex items-center gap-3">
          <Avatar className="h-14 w-14 border border-white/10">
            <AvatarFallback>{initials(dashboard.profile.displayName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-semibold">{dashboard.profile.displayName}</p>
            <p className="text-sm text-muted-foreground">@{dashboard.profile.username}</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><p className="text-muted-foreground">Trust Score</p><p className="font-semibold text-primary">{dashboard.profile.twoFactorEnabled ? "Высокий" : "Базовый"}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><p className="text-muted-foreground">Репутация</p><p className="font-semibold">{dashboard.connections.length + dashboard.rooms.length}</p></div>
        </div>
      </Card>

      <Card className="social-card relative overflow-hidden p-5">
        <div className="mb-4 flex items-center justify-between"><h2 className="font-display text-lg font-semibold">Активность</h2><Zap className="h-4 w-4 text-primary" /></div>
        <div className="grid grid-cols-2 gap-3">
          {activityItems.map((item) => (
            <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <item.icon className="mb-2 h-4 w-4 text-primary" />
              <p className="text-lg font-semibold">{item.value}</p>
              <p className="text-xs text-muted-foreground">{item.label}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="social-card relative overflow-hidden p-5">
        <div className="mb-4 flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /><h2 className="font-display text-lg font-semibold">Безопасность</h2></div>
        <div className="space-y-3 text-sm">
          <p className="flex justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2"><span>Шифрование</span><span className="text-primary">Активно</span></p>
          <p className="flex justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2"><span>Уровень аккаунта</span><span>{securityLevel}</span></p>
          <p className="flex justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2"><span>Предупреждения</span><span>{dashboard.flags.length + dashboard.alerts.length}</span></p>
        </div>
      </Card>

      <Card className="social-card relative overflow-hidden p-5">
        <div className="mb-4 flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /><h2 className="font-display text-lg font-semibold">Рекомендации API</h2></div>
        {recommendationItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">Рекомендации появятся после появления связей, комнат и событий в Backend API.</p>
        ) : (
          <div className="space-y-3">
            {recommendationItems.map((item) => (
              <Link key={`${item.title}-${item.detail}`} href={item.href} className="block rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 transition hover:border-primary/30">
                <p className="truncate text-sm font-semibold">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.detail}</p>
              </Link>
            ))}
          </div>
        )}
      </Card>

      <Card className="social-card relative overflow-hidden p-5">
        <div className="mb-3 flex items-center gap-2"><Bot className="h-4 w-4 text-primary" /><h2 className="font-display text-lg font-semibold">AI Assistant</h2></div>
        <p className="text-sm leading-6 text-muted-foreground">ИИ-помощник анализирует доступные API-сигналы: {dashboard.posts.length} постов, {dashboard.rooms.length} комнат, {dashboard.connections.length} связей.</p>
      </Card>
    </aside>
  );
}

export default function FeedPage() {
  const { data, isLoading, isError, error, reload } = useAsyncResource(loadDashboard, []);

  if (isError) {
    return (
      <StateCard
        title="Главная страница недоступна"
        description={error?.message ?? "Не удалось загрузить данные Backend API."}
        variant="error"
        action={<Button onClick={() => void reload()} variant="outline">Повторить</Button>}
      />
    );
  }

  if (isLoading || !data) {
    return <StateCard title="Загружаем главную" description="Получаем ленту, истории, профиль, безопасность и активность из Backend API." />;
  }

  return (
    <div className="feed-shell -m-2 rounded-[2.5rem] p-2">
      <div className="relative grid gap-5 xl:grid-cols-[minmax(0,720px)_360px] 2xl:grid-cols-[minmax(0,760px)_380px]">
        <main className="space-y-5">
          <section className="relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.09),rgba(255,255,255,0.025))] p-6 shadow-[0_28px_80px_rgba(0,0,0,0.42)] backdrop-blur-2xl sm:p-8">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(102,244,255,0.18),transparent_28%),radial-gradient(circle_at_88%_20%,rgba(138,125,255,0.14),transparent_24%)]" />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl space-y-4">
                <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs uppercase tracking-[0.24em] text-primary/90"><Radar className="h-3.5 w-3.5" /> GAPAK Live</p>
                <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-[-0.04em] text-white sm:text-5xl">Премиальная социальная лента с контролем доверия</h1>
                <p className="max-w-xl text-base leading-7 text-muted-foreground">Все блоки главной получают данные из Backend API: публикации, истории, комнаты, чаты, безопасность и профиль.</p>
              </div>
              <div className="grid min-w-[220px] grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><p className="text-2xl font-semibold">{data.posts.length}</p><p className="text-muted-foreground">постов</p></div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><p className="text-2xl font-semibold">{data.stories.length}</p><p className="text-muted-foreground">историй</p></div>
              </div>
            </div>
          </section>

          <StoryRail dashboard={data} onReload={() => void reload()} />
          <ComposerCard profile={data.profile} />
          <TemporaryRooms rooms={data.rooms} />

          {data.posts.length === 0 ? (
            <EmptyState title="Публикаций пока нет" description="Создайте первую публикацию, и она сразу появится в ленте из Backend API." action={<Button asChild><Link href="/posts/new">Создать</Link></Button>} />
          ) : (
            data.posts.map((post) => <PostCard key={post.id} post={post} currentUserId={data.profile.id} currentUserName={data.profile.displayName} />)
          )}
        </main>

        <div className="hidden xl:block">
          <RightPanel dashboard={data} />
        </div>
      </div>
    </div>
  );
}
