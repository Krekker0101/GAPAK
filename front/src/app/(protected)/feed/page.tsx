import { FeedHomePage } from "@/features/feed/components/feed-home-page";

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
  return <FeedHomePage />;
}
