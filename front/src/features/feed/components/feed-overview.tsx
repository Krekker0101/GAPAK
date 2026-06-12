"use client";

import { calculateTrustScore } from "@/features/feed/lib/home-dashboard";
import type { HomeDashboardViewModel } from "@/features/feed/types/home-dashboard";

export function FeedOverview({ dashboard }: { dashboard: HomeDashboardViewModel }) {
  return (
    <section className="feed-shell relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-[linear-gradient(135deg,rgba(14,20,30,0.88),rgba(8,12,18,0.72))] p-5 shadow-[0_28px_80px_rgba(0,0,0,0.42)] backdrop-blur-2xl sm:p-7">
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-primary/90">Gapak premium social</p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl">Главная лента</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Живые публикации, истории, безопасность, комнаты и рекомендации загружаются только из Backend API.</p>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:min-w-[270px]">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center"><p className="text-xl font-semibold">{dashboard.posts.length}</p><p className="text-[11px] text-muted-foreground">Постов</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center"><p className="text-xl font-semibold">{dashboard.stories.length}</p><p className="text-[11px] text-muted-foreground">Историй</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center"><p className="text-xl font-semibold">{calculateTrustScore(dashboard)}</p><p className="text-[11px] text-muted-foreground">Trust</p></div>
        </div>
      </div>
    </section>
  );
}
