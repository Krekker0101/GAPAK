"use client";

import { calculateTrustScore } from "@/features/feed/lib/home-dashboard";
import type { HomeDashboardViewModel } from "@/features/feed/types/home-dashboard";
import { Badge } from "@/shared/ui/badge";

export function FeedOverview({ dashboard }: { dashboard: HomeDashboardViewModel }) {
  return (
    <section className="social-card glass-panel relative overflow-hidden rounded-[2.25rem] p-5 sm:p-7">
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.32em] text-primary/90">Gapak premium social</p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Главная лента</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Живые публикации, истории, безопасность, комнаты и рекомендации загружаются только из Backend API.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[420px]">
          <div className="rounded-2xl border border-white/8 bg-background/35 p-3 text-center">
            <p className="text-xl font-semibold">{dashboard.posts.length}</p>
            <p className="text-[11px] text-muted-foreground">Постов</p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-background/35 p-3 text-center">
            <p className="text-xl font-semibold">{dashboard.stories.length}</p>
            <p className="text-[11px] text-muted-foreground">Историй</p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-background/35 p-3 text-center">
            <p className="text-xl font-semibold">{calculateTrustScore(dashboard)}</p>
            <p className="text-[11px] text-muted-foreground">Trust</p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-background/35 p-3 text-center">
            <p className="text-xl font-semibold">{dashboard.rooms.length}</p>
            <p className="text-[11px] text-muted-foreground">Rooms</p>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Badge variant="primary">Backend-driven</Badge>
        <Badge variant="trusted">Premium UI</Badge>
        <Badge variant="success">Adaptive theme</Badge>
      </div>
    </section>
  );
}
