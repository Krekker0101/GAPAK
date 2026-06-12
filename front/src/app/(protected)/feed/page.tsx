"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Bell,
  Bot,
  ChevronRight,
  CirclePlus,
  Clock3,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Timer,
  Verified,
  WandSparkles,
} from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { StateCard } from "@/components/common/state-card";
import { PostCard } from "@/components/feed/post-card";
import { chatService } from "@/shared/api/services/chat.service";
import { connectionService } from "@/shared/api/services/connection.service";
import { postService } from "@/shared/api/services/post.service";
import { roomService } from "@/shared/api/services/room.service";
import { securityService } from "@/shared/api/services/security.service";
import { sessionService } from "@/shared/api/services/session.service";
import { storyService } from "@/shared/api/services/story.service";
import { userService } from "@/shared/api/services/user.service";
import { useAsyncResource } from "@/shared/lib/hooks/use-async-resource";
import { useMediaUrl } from "@/shared/lib/hooks/use-media-url";
import { formatRelativeTime } from "@/shared/lib/utils";
import type { ChatResponse } from "@/shared/types/chat";
import type { ConnectionResponse } from "@/shared/types/connection";
import type { PostResponse } from "@/shared/types/post";
import type { TrustRoomResponse } from "@/shared/types/room";
import type { AuditEventResponse, DeviceAlertResponse, SuspiciousFlagResponse } from "@/shared/types/security";
import type { SessionResponse } from "@/shared/types/session";
import type { StoryResponse } from "@/shared/types/story";
import type { ProfileResponse } from "@/shared/types/user";
import { Avatar, AvatarFallback } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";

const FEED_PAGE_SIZE = 10;

type HomeDashboard = {
  profile: ProfileResponse;
  stories: StoryResponse[];
  posts: PostResponse[];
  rooms: TrustRoomResponse[];
  chats: ChatResponse[];
  connections: ConnectionResponse[];
  sessions: SessionResponse[];
  auditEvents: AuditEventResponse[];
  flags: SuspiciousFlagResponse[];
  alerts: DeviceAlertResponse[];
};

type RoomDuration = "1h" | "24h" | "7d";

const durationOptions: Array<{ value: RoomDuration; label: string; retentionDays: number }> = [
  { value: "1h", label: "1 час", retentionDays: 1 },
  { value: "24h", label: "24 часа", retentionDays: 1 },
  { value: "7d", label: "Неделя", retentionDays: 7 },
];

async function loadHomeDashboard(): Promise<HomeDashboard> {
  const [profile, stories, posts, rooms, chats, connections, sessions, auditEvents, flags, alerts] = await Promise.all([
    userService.getMe(),
    storyService.getFeed({ page: 1, limit: 20 }),
    postService.getFeed({ page: 1, limit: FEED_PAGE_SIZE }),
    roomService.listRooms(),
    chatService.listChats(),
    connectionService.listConnections(),
    sessionService.listSessions(),
    securityService.getAuditEvents(),
    securityService.getFlags(),
    securityService.getAlerts(),
  ]);

  return { profile, stories, posts, rooms, chats, connections, sessions, auditEvents, flags, alerts };
}

function shortId(value: string) {
  return value.length > 12 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
}

function initials(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "GP";
}

function trustScore(dashboard: HomeDashboard) {
  let score = 48;
  if (dashboard.profile.twoFactorEnabled) score += 18;
  if (dashboard.sessions.some((session) => session.securityLevel === "TRUSTED")) score += 10;
  if (dashboard.flags.length === 0) score += 14;
  if (dashboard.alerts.every((alert) => alert.status === "ACKNOWLEDGED")) score += 5;
  if (dashboard.profile.privacy.profileVisibility !== "PUBLIC") score += 5;
  return Math.min(100, score);
}

function StoryAvatar({ story, isMine }: { story: StoryResponse; isMine: boolean }) {
  const { url } = useMediaUrl(story.mediaFileId, "story-ring-preview");

  return (
    <button type="button" className="group min-w-[88px] text-left" aria-label={`Открыть историю ${shortId(story.id)}`}>
      <div className="relative mx-auto h-[76px] w-[76px] rounded-full bg-[linear-gradient(135deg,rgba(102,244,255,0.95),rgba(138,125,255,0.86),rgba(255,255,255,0.58))] p-[2px] shadow-[0_0_32px_rgba(102,244,255,0.18)] transition duration-300 group-hover:scale-105">
        <div className="h-full w-full overflow-hidden rounded-full border-2 border-background bg-card">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="Story" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_30%_20%,rgba(102,244,255,0.22),rgba(138,125,255,0.16))] text-xs font-semibold text-white">
              {isMine ? "Вы" : initials(story.authorId)}
            </div>
          )}
        </div>
        <span className="absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-background bg-emerald-300" />
      </div>
      <p className="mt-2 truncate text-center text-xs text-muted-foreground">{isMine ? "Моя история" : `user:${shortId(story.authorId)}`}</p>
    </button>
  );
}

function StoriesRail({ profile, stories }: { profile: ProfileResponse; stories: StoryResponse[] }) {
  const myStories = stories.filter((story) => story.authorId === profile.id);
  const otherStories = stories.filter((story) => story.authorId !== profile.id);
  const orderedStories = [...myStories, ...otherStories];

  return (
    <Card className="overflow-hidden p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-primary/90">Live stories</p>
          <h2 className="font-display text-xl font-semibold">Истории из Backend API</h2>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/posts/new">
            <Plus className="h-4 w-4" />
            Загрузить
          </Link>
        </Button>
      </div>
      {orderedStories.length === 0 ? (
        <div className="rounded-[1.5rem] border border-dashed border-white/12 bg-white/[0.025] p-6 text-sm text-muted-foreground">
          В API пока нет активных историй. Созданные истории появятся здесь первыми, без моковых данных.
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {orderedStories.map((story) => <StoryAvatar key={story.id} story={story} isMine={story.authorId === profile.id} />)}
        </div>
      )}
    </Card>
  );
}

function QuickComposer({ profile }: { profile: ProfileResponse }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <Avatar className="h-12 w-12 border border-primary/20">
          <AvatarFallback>{initials(profile.displayName)}</AvatarFallback>
        </Avatar>
        <Button asChild variant="outline" className="h-12 flex-1 justify-start rounded-full px-5 text-muted-foreground">
          <Link href="/posts/new">Что нового, {profile.displayName}?</Link>
        </Button>
        <Button asChild className="hidden h-12 rounded-full sm:inline-flex">
          <Link href="/posts/new">
            <CirclePlus className="h-4 w-4" />
            Пост
          </Link>
        </Button>
      </div>
    </Card>
  );
}

function TemporaryRoomPanel({ onCreated }: { onCreated: (room: TrustRoomResponse) => void }) {
  const [name, setName] = useState("");
  const [duration, setDuration] = useState<RoomDuration>("24h");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = durationOptions.find((item) => item.value === duration) ?? durationOptions[1];

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const roomName = name.trim();
    if (!roomName) return;
    setSubmitting(true);
    setError(null);
    try {
      const room = await roomService.create({
        name: roomName,
        description: `Temporary access window: ${selected.label}`,
        visibility: "PRIVATE",
        accessMode: "OWNER_APPROVAL",
        requireTwoFactor: true,
        minAccountAgeDays: 0,
        messageRetentionDays: selected.retentionDays,
      });
      setName("");
      onCreated(room);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Комната не создана");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-primary/90">Temporary rooms</p>
          <h3 className="font-display text-lg font-semibold">Временная комната</h3>
        </div>
        <Timer className="h-5 w-5 text-primary" />
      </div>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Название комнаты" className="h-11 w-full rounded-2xl border border-white/10 bg-black/20 px-4 text-sm outline-none transition focus:border-primary/50" />
        <div className="grid grid-cols-3 gap-2">
          {durationOptions.map((item) => (
            <button key={item.value} type="button" onClick={() => setDuration(item.value)} className={`rounded-2xl border px-3 py-2 text-xs transition ${duration === item.value ? "border-primary/50 bg-primary/15 text-primary" : "border-white/10 bg-white/[0.03] text-muted-foreground hover:text-foreground"}`}>
              {item.label}
            </button>
          ))}
        </div>
        {error ? <p className="rounded-2xl border border-red-300/20 bg-red-400/10 px-3 py-2 text-xs text-red-100">{error}</p> : null}
        <Button type="submit" disabled={submitting || !name.trim()} className="w-full">
          {submitting ? "Создаём…" : "Создать через API"}
        </Button>
      </form>
    </Card>
  );
}

function MiniProfile({ dashboard }: { dashboard: HomeDashboard }) {
  const score = trustScore(dashboard);
  return (
    <Card className="p-5">
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16 border border-primary/25 shadow-glow">
          <AvatarFallback className="text-base">{initials(dashboard.profile.displayName)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-display text-lg font-semibold">{dashboard.profile.displayName}</h3>
            {dashboard.profile.twoFactorEnabled ? <Verified className="h-4 w-4 text-primary" /> : null}
          </div>
          <p className="text-sm text-muted-foreground">@{dashboard.profile.username}</p>
          <p className="mt-1 text-xs text-muted-foreground">Роль: {dashboard.profile.role}</p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
          <p className="text-xs text-muted-foreground">Trust Score</p>
          <p className="mt-1 text-2xl font-semibold text-primary">{score}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
          <p className="text-xs text-muted-foreground">Репутация</p>
          <p className="mt-1 text-2xl font-semibold">{dashboard.connections.filter((item) => item.status === "ACCEPTED").length}</p>
        </div>
      </div>
    </Card>
  );
}

function ActivityPanel({ dashboard }: { dashboard: HomeDashboard }) {
  const pendingConnections = dashboard.connections.filter((item) => item.status === "PENDING").length;
  const latestChat = dashboard.chats.slice().sort((a, b) => new Date(b.lastMessageAt ?? b.createdAt).getTime() - new Date(a.lastMessageAt ?? a.createdAt).getTime())[0];
  const views = dashboard.stories.reduce((total, story) => total + story.viewerCount, 0);
  const reactions = dashboard.posts.reduce((total, post) => total + (post.likeCount ?? 0), 0);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold">Активность</h3>
        <Bell className="h-5 w-5 text-primary" />
      </div>
      <div className="mt-4 grid gap-2">
        <div className="flex items-center justify-between rounded-2xl bg-white/[0.035] p-3 text-sm"><span>Новые сообщения</span><span>{latestChat ? formatRelativeTime(latestChat.lastMessageAt ?? latestChat.createdAt) : "0"}</span></div>
        <div className="flex items-center justify-between rounded-2xl bg-white/[0.035] p-3 text-sm"><span>Заявки</span><span>{pendingConnections}</span></div>
        <div className="flex items-center justify-between rounded-2xl bg-white/[0.035] p-3 text-sm"><span>Реакции</span><span>{reactions}</span></div>
        <div className="flex items-center justify-between rounded-2xl bg-white/[0.035] p-3 text-sm"><span>Просмотры историй</span><span>{views}</span></div>
      </div>
    </Card>
  );
}

function SecurityPanel({ dashboard }: { dashboard: HomeDashboard }) {
  const riskySessions = dashboard.sessions.filter((session) => session.securityLevel === "RISKY").length;
  const openFlags = dashboard.flags.filter((flag) => flag.status === "OPEN").length;
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold">Безопасность</h3>
        {openFlags || riskySessions ? <ShieldAlert className="h-5 w-5 text-amber-200" /> : <ShieldCheck className="h-5 w-5 text-emerald-200" />}
      </div>
      <div className="mt-4 space-y-3 text-sm">
        <div className="flex items-center justify-between"><span className="text-muted-foreground">Шифрование</span><span className="text-emerald-100">Активно</span></div>
        <div className="flex items-center justify-between"><span className="text-muted-foreground">2FA</span><span>{dashboard.profile.twoFactorEnabled ? "Включено" : "Отключено"}</span></div>
        <div className="flex items-center justify-between"><span className="text-muted-foreground">Риск-сессии</span><span>{riskySessions}</span></div>
        <div className="flex items-center justify-between"><span className="text-muted-foreground">Подозрительная активность</span><span>{openFlags}</span></div>
      </div>
      {dashboard.auditEvents[0] ? <p className="mt-4 rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-xs text-muted-foreground">Последний аудит: {dashboard.auditEvents[0].action} · {formatRelativeTime(dashboard.auditEvents[0].createdAt)}</p> : null}
    </Card>
  );
}

function RecommendationsPanel({ dashboard }: { dashboard: HomeDashboard }) {
  const people = dashboard.connections.slice(0, 4);
  const rooms = dashboard.rooms.slice(0, 4);
  const events = dashboard.auditEvents.slice(0, 3);
  const projects = dashboard.posts.filter((post) => post.privacy === "TIMED" || Boolean(post.expiresAt)).slice(0, 3);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold">Рекомендации API</h3>
        <Sparkles className="h-5 w-5 text-primary" />
      </div>
      <div className="mt-4 space-y-4">
        <section>
          <p className="mb-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">Люди</p>
          {people.length ? people.map((item) => <p key={item.id} className="rounded-2xl bg-white/[0.035] p-3 text-sm">Связь {shortId(item.id)} · {item.status}</p>) : <p className="text-sm text-muted-foreground">API не вернул новых людей.</p>}
        </section>
        <section>
          <p className="mb-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">Сообщества</p>
          {rooms.length ? rooms.map((room) => <Link key={room.id} href="/rooms" className="mb-2 flex items-center justify-between rounded-2xl bg-white/[0.035] p-3 text-sm transition hover:bg-white/[0.06]"><span>{room.name}</span><ChevronRight className="h-4 w-4" /></Link>) : <p className="text-sm text-muted-foreground">Комнаты появятся после ответа API.</p>}
        </section>
        <section>
          <p className="mb-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">События</p>
          {events.length ? events.map((event) => <p key={event.id} className="rounded-2xl bg-white/[0.035] p-3 text-sm">{event.action} · {formatRelativeTime(event.createdAt)}</p>) : <p className="text-sm text-muted-foreground">Событий пока нет.</p>}
        </section>
        <section>
          <p className="mb-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">Проекты</p>
          {projects.length ? projects.map((post) => <p key={post.id} className="rounded-2xl bg-white/[0.035] p-3 text-sm">Пост {shortId(post.id)} · {post.privacy}</p>) : <p className="text-sm text-muted-foreground">Временных проектов пока нет.</p>}
        </section>
      </div>
    </Card>
  );
}

function AssistantWidget({ dashboard }: { dashboard: HomeDashboard }) {
  const score = trustScore(dashboard);
  return (
    <Card className="overflow-hidden p-5">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(138,125,255,0.18),transparent_28%)]" />
      <div className="relative flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 text-primary"><Bot className="h-5 w-5" /></div>
        <div>
          <h3 className="font-display text-lg font-semibold">AI Assistant</h3>
          <p className="text-xs text-muted-foreground">Контекст построен из backend данных</p>
        </div>
      </div>
      <div className="relative mt-4 space-y-2 text-sm text-muted-foreground">
        <p className="rounded-2xl bg-white/[0.04] p-3">Профиль: Trust Score {score}. {dashboard.profile.twoFactorEnabled ? "Защита выглядит устойчиво." : "Включите 2FA для усиления профиля."}</p>
        <Link href="/rooms" className="flex items-center justify-between rounded-2xl bg-white/[0.04] p-3 transition hover:bg-white/[0.06]"><span>Подобрать сообщества</span><WandSparkles className="h-4 w-4" /></Link>
        <Link href="/posts/new" className="flex items-center justify-between rounded-2xl bg-white/[0.04] p-3 transition hover:bg-white/[0.06]"><span>Сгенерировать пост</span><WandSparkles className="h-4 w-4" /></Link>
      </div>
    </Card>
  );
}

export default function FeedPage() {
  const { data, isLoading, isError, error, reload } = useAsyncResource(loadHomeDashboard, []);
  const [posts, setPosts] = useState<PostResponse[]>([]);
  const [rooms, setRooms] = useState<TrustRoomResponse[]>([]);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (data) {
      setPosts(data.posts);
      setRooms(data.rooms);
      setPage(1);
      setHasMore(data.posts.length === FEED_PAGE_SIZE);
    }
  }, [data]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
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
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        void loadMore();
      }
    }, { rootMargin: "600px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore]);

  if (isError) {
    return (
      <StateCard title="Главная страница недоступна" description={error?.message ?? "Backend API не вернул данные для главной страницы."} variant="error" action={<Button onClick={() => void reload()} variant="outline">Повторить</Button>} />
    );
  }

  if (isLoading || !data) {
    return (
      <div className="grid gap-5 xl:grid-cols-[minmax(0,680px)_360px] xl:justify-center 2xl:grid-cols-[minmax(0,720px)_380px]">
        <div className="space-y-5">
          {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-44 animate-pulse rounded-[2rem] border border-white/10 bg-white/[0.04]" />)}
        </div>
        <div className="hidden space-y-5 xl:block">
          {Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-52 animate-pulse rounded-[2rem] border border-white/10 bg-white/[0.04]" />)}
        </div>
      </div>
    );
  }

  const dashboard = { ...data, posts, rooms };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,680px)_360px] xl:justify-center 2xl:grid-cols-[minmax(0,720px)_380px]">
      <div className="min-w-0 space-y-5">
        <section className="feed-shell relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-[linear-gradient(135deg,rgba(14,20,30,0.88),rgba(8,12,18,0.72))] p-5 shadow-[0_28px_80px_rgba(0,0,0,0.42)] backdrop-blur-2xl sm:p-7">
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-primary/90">Gapak premium social</p>
              <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl">Главная лента</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Живые публикации, истории, безопасность, комнаты и рекомендации загружаются только из Backend API.</p>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:min-w-[270px]">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center"><p className="text-xl font-semibold">{posts.length}</p><p className="text-[11px] text-muted-foreground">Постов</p></div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center"><p className="text-xl font-semibold">{data.stories.length}</p><p className="text-[11px] text-muted-foreground">Историй</p></div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center"><p className="text-xl font-semibold">{trustScore(dashboard)}</p><p className="text-[11px] text-muted-foreground">Trust</p></div>
            </div>
          </div>
        </section>

        <StoriesRail profile={data.profile} stories={data.stories} />
        <QuickComposer profile={data.profile} />
        <TemporaryRoomPanel onCreated={(room) => setRooms((current) => [room, ...current])} />

        <div className="space-y-4">
          {posts.length === 0 ? (
            <EmptyState title="В backend пока нет публикаций" description="Создайте первую публикацию — она появится в этой ленте без статических примеров." action={<Button asChild><Link href="/posts/new">Создать</Link></Button>} />
          ) : (
            posts.map((post) => <PostCard key={post.id} post={post} />)
          )}
          <div ref={loadMoreRef} className="py-4 text-center text-sm text-muted-foreground">
            {loadingMore ? "Загружаем ещё через API…" : hasMore ? "Прокрутите ниже для продолжения" : "Все доступные публикации загружены"}
          </div>
        </div>
      </div>

      <aside className="hidden space-y-5 xl:block">
        <div className="sticky top-4 space-y-5">
          <MiniProfile dashboard={dashboard} />
          <ActivityPanel dashboard={dashboard} />
          <SecurityPanel dashboard={dashboard} />
          <RecommendationsPanel dashboard={dashboard} />
          <AssistantWidget dashboard={dashboard} />
        </div>
      </aside>
    </div>
  );
}
