"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Bot, ChevronRight, ShieldAlert, ShieldCheck, Sparkles, Verified, WandSparkles } from "lucide-react";

import { calculateTrustScore, initials, shortId } from "@/features/feed/lib/home-dashboard";
import type { HomeDashboardViewModel } from "@/features/feed/types/home-dashboard";
import type { ProfileVisibility } from "@/shared/types/user";
import { userService } from "@/shared/api/services/user.service";
import { cn, formatRelativeTime } from "@/shared/lib/utils";
import { Avatar, AvatarFallback } from "@/shared/ui/avatar";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";

export function MiniProfile({ dashboard }: { dashboard: HomeDashboardViewModel }) {
  const score = calculateTrustScore(dashboard);

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
        <div className="rounded-2xl border border-white/8 bg-background/35 p-3">
          <p className="text-xs text-muted-foreground">Trust Score</p>
          <p className="mt-1 text-2xl font-semibold text-primary">{score}</p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-background/35 p-3">
          <p className="text-xs text-muted-foreground">Репутация</p>
          <p className="mt-1 text-2xl font-semibold">{dashboard.connections.filter((item) => item.status === "ACCEPTED").length}</p>
        </div>
      </div>
    </Card>
  );
}

export function ActivityPanel({ dashboard }: { dashboard: HomeDashboardViewModel }) {
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
        <div className="flex items-center justify-between rounded-2xl bg-background/35 p-3 text-sm">
          <span>Новые сообщения</span>
          <span>{latestChat ? formatRelativeTime(latestChat.lastMessageAt ?? latestChat.createdAt) : "0"}</span>
        </div>
        <div className="flex items-center justify-between rounded-2xl bg-background/35 p-3 text-sm">
          <span>Заявки</span>
          <span>{pendingConnections}</span>
        </div>
        <div className="flex items-center justify-between rounded-2xl bg-background/35 p-3 text-sm">
          <span>Реакции</span>
          <span>{reactions}</span>
        </div>
        <div className="flex items-center justify-between rounded-2xl bg-background/35 p-3 text-sm">
          <span>Просмотры историй</span>
          <span>{views}</span>
        </div>
      </div>
    </Card>
  );
}

export function SecurityPanel({ dashboard }: { dashboard: HomeDashboardViewModel }) {
  const riskySessions = dashboard.sessions.filter((session) => session.securityLevel === "RISKY").length;
  const openFlags = dashboard.flags.filter((flag) => flag.status === "OPEN").length;

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold">Безопасность</h3>
        {openFlags || riskySessions ? <ShieldAlert className="h-5 w-5 text-amber-200" /> : <ShieldCheck className="h-5 w-5 text-emerald-200" />}
      </div>
      <div className="mt-4 space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Шифрование</span>
          <span className="text-emerald-100">Активно</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">2FA</span>
          <span>{dashboard.profile.twoFactorEnabled ? "Включено" : "Отключено"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Риск-сессии</span>
          <span>{riskySessions}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Подозрительная активность</span>
          <span>{openFlags}</span>
        </div>
      </div>
      {dashboard.auditEvents[0] ? (
        <p className="mt-4 rounded-2xl border border-white/8 bg-background/35 p-3 text-xs text-muted-foreground">
          Последний аудит: {dashboard.auditEvents[0].action} · {formatRelativeTime(dashboard.auditEvents[0].createdAt)}
        </p>
      ) : null}
    </Card>
  );
}

export function RecommendationsPanel({ dashboard }: { dashboard: HomeDashboardViewModel }) {
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
          {people.length ? people.map((item) => <p key={item.id} className="rounded-2xl bg-background/35 p-3 text-sm">Связь {shortId(item.id)} · {item.status}</p>) : <p className="text-sm text-muted-foreground">Backend не вернул новых людей.</p>}
        </section>
        <section>
          <p className="mb-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">Сообщества</p>
          {rooms.length ? rooms.map((room) => <Link key={room.id} href={`/rooms/${room.id}`} className="mb-2 flex items-center justify-between rounded-2xl bg-background/35 p-3 text-sm transition hover:bg-background/50"><span>{room.name}</span><ChevronRight className="h-4 w-4" /></Link>) : <p className="text-sm text-muted-foreground">Backend не вернул комнаты.</p>}
        </section>
        <section>
          <p className="mb-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">События</p>
          {events.length ? events.map((event) => <p key={event.id} className="rounded-2xl bg-background/35 p-3 text-sm">{event.action} · {formatRelativeTime(event.createdAt)}</p>) : <p className="text-sm text-muted-foreground">Backend не вернул событий.</p>}
        </section>
        <section>
          <p className="mb-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">Проекты</p>
          {projects.length ? projects.map((post) => <p key={post.id} className="rounded-2xl bg-background/35 p-3 text-sm">Пост {shortId(post.id)} · {post.privacy}</p>) : <p className="text-sm text-muted-foreground">Backend не вернул временные проекты.</p>}
        </section>
      </div>
    </Card>
  );
}

export function AssistantWidget({ dashboard }: { dashboard: HomeDashboardViewModel }) {
  const score = calculateTrustScore(dashboard);

  return (
    <Card className="overflow-hidden p-5">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(138,125,255,0.18),transparent_28%)]" />
      <div className="relative flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <Bot className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-display text-lg font-semibold">AI Assistant</h3>
          <p className="text-xs text-muted-foreground">Контекст построен из backend данных</p>
        </div>
      </div>
      <div className="relative mt-4 space-y-2 text-sm text-muted-foreground">
        <p className="rounded-2xl bg-background/35 p-3">Профиль: Trust Score {score}. {dashboard.profile.twoFactorEnabled ? "Защита выглядит устойчиво." : "Включите 2FA для усиления профиля."}</p>
        <Link href="/rooms" className="flex items-center justify-between rounded-2xl bg-background/35 p-3 transition hover:bg-background/50"><span>Подобрать сообщества</span><WandSparkles className="h-4 w-4" /></Link>
        <Link href="/posts/new" className="flex items-center justify-between rounded-2xl bg-background/35 p-3 transition hover:bg-background/50"><span>Сгенерировать пост</span><WandSparkles className="h-4 w-4" /></Link>
      </div>
    </Card>
  );
}



export function AccessControlPanel({ dashboard }: { dashboard: HomeDashboardViewModel }) {
  const [visibility, setVisibility] = useState<ProfileVisibility>(dashboard.profile.privacy.profileVisibility);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setVisibility(dashboard.profile.privacy.profileVisibility);
  }, [dashboard.profile.privacy.profileVisibility]);

  const updateVisibility = async (nextVisibility: ProfileVisibility) => {
    if (saving || nextVisibility === visibility) {
      return;
    }

    setSaving(true);
    try {
      await userService.updatePrivacy({
        ...dashboard.profile.privacy,
        profileVisibility: nextVisibility,
      });
      setVisibility(nextVisibility);
    } catch {
      // Keep the current visibility if the backend rejects the update.
    } finally {
      setSaving(false);
    }
  };

  const options: Array<{ value: ProfileVisibility; label: string; detail: string }> = [
    { value: "PUBLIC", label: "Public", detail: "Visible to everyone" },
    { value: "CONNECTIONS", label: "Connections", detail: "Visible to your connections" },
    { value: "TRUSTED_ONLY", label: "Trusted", detail: "Visible to trusted circle" },
    { value: "PRIVATE", label: "Private", detail: "Visible only to you" },
  ];

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold">Timed access</h3>
          <p className="text-xs text-muted-foreground">Profile access is controlled through live API settings.</p>
        </div>
        <Badge variant="primary">Live API</Badge>
      </div>

      <div className="mt-4 grid gap-2">
        <div className="rounded-2xl bg-background/35 p-3 text-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Current profile access</p>
          <p className="mt-1 font-medium">{visibility.replace(/_/g, " ")}</p>
        </div>
        <div className="rounded-2xl bg-background/35 p-3 text-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Default post privacy</p>
          <p className="mt-1 font-medium">{dashboard.profile.privacy.postDefaultPrivacy.replace(/_/g, " ")}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        {options.map((option) => {
          const active = option.value === visibility;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => void updateVisibility(option.value)}
              disabled={saving}
              className={cn(
                "flex items-start justify-between gap-3 rounded-2xl border px-3 py-3 text-left text-sm transition",
                active
                  ? "border-primary/40 bg-primary/10 text-foreground"
                  : "border-white/8 bg-background/30 text-muted-foreground hover:text-foreground",
              )}
            >
              <span>
                <span className="block font-medium">{option.label}</span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">{option.detail}</span>
              </span>
              {active ? <Badge variant="primary">Active</Badge> : null}
            </button>
          );
        })}
      </div>

      <div className="mt-4 rounded-2xl border border-white/8 bg-background/30 p-3 text-xs leading-6 text-muted-foreground">
        Need a timed post or room? Create it from the composer or the temporary room widget and the backend will handle expiry.
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/posts/new">New timed post</Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href="/settings/privacy">Privacy settings</Link>
        </Button>
      </div>
    </Card>
  );
}

export function DashboardAside({ dashboard }: { dashboard: HomeDashboardViewModel }) {
  return (
    <aside className="hidden space-y-5 xl:block">
      <div className="sticky top-4 space-y-5">
        <MiniProfile dashboard={dashboard} />
        <ActivityPanel dashboard={dashboard} />
        <SecurityPanel dashboard={dashboard} />
        <AccessControlPanel dashboard={dashboard} />
        <RecommendationsPanel dashboard={dashboard} />
        <AssistantWidget dashboard={dashboard} />
      </div>
    </aside>
  );
}
