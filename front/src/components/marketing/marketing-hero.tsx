"use client";

import { ArrowRight, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { LocaleLink } from "@/shared/i18n/locale-link";
import { useI18n } from "@/shared/i18n/provider";

export function MarketingHero() {
  const { t } = useI18n();
  const metrics = [
    { label: t("landing.metrics.visibility"), value: t("landing.metrics.visibilityValue"), detail: t("landing.metrics.visibilityDetail") },
    { label: t("landing.metrics.security"), value: t("landing.metrics.securityValue"), detail: t("landing.metrics.securityDetail") },
    { label: t("landing.metrics.rooms"), value: t("landing.metrics.roomsValue"), detail: t("landing.metrics.roomsDetail") },
  ];
  const heroCards = [
    {
      title: t("landing.heroCards.visibilityTitle"),
      description: t("landing.heroCards.visibilityText"),
      icon: LockKeyhole,
    },
    {
      title: t("landing.heroCards.roomsTitle"),
      description: t("landing.heroCards.roomsText"),
      icon: Sparkles,
    },
    {
      title: t("landing.heroCards.securityTitle"),
      description: t("landing.heroCards.securityText"),
      icon: ShieldCheck,
    },
  ];

  return (
    <section className="glass-panel relative overflow-hidden rounded-[2.5rem] px-6 py-10 shadow-glow md:px-10 md:py-16">
      <div className="ambient-grid absolute inset-0 opacity-[0.1]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(102,244,255,0.14),_transparent_26%),radial-gradient(circle_at_bottom_right,_rgba(255,178,244,0.12),_transparent_26%)]" />
      <div className="ambient-orb left-[8%] top-[12%] h-32 w-32 bg-cyan-300/25 animate-drift" />
      <div className="ambient-orb right-[8%] top-[18%] h-36 w-36 bg-fuchsia-300/20 animate-float" />
      <div className="absolute inset-x-10 top-0 h-px animate-pulse-line bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
      <div className="relative grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
        <div className="space-y-8">
          <Badge variant="primary" className="w-fit">
            {t("landing.badge")}
          </Badge>
          <div className="space-y-5">
            <h1 className="font-display text-5xl font-semibold leading-[1.05] text-balance md:text-7xl">
              {t("landing.headlineA")}
              <span className="block text-primary">{t("landing.headlineB")}</span>
            </h1>
            <p className="max-w-2xl text-base leading-8 text-muted-foreground md:text-lg">
              {t("landing.description")}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <LocaleLink href="/register">
                {t("landing.createSpace")}
                <ArrowRight className="h-4 w-4" />
              </LocaleLink>
            </Button>
            <Button asChild size="lg" variant="outline">
              <LocaleLink href="/login">{t("landing.signInSecurely")}</LocaleLink>
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {metrics.map((metric) => (
              <div key={metric.label} className="glass-surface p-5">
                <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">{metric.label}</p>
                <p className="mt-4 font-display text-3xl font-semibold">{metric.value}</p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{metric.detail}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="glass-panel relative rounded-[2rem] p-6">
          <div className="absolute inset-x-6 top-6 h-px animate-pulse-line bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          <div className="grid gap-4 pt-5">
            {heroCards.map((item) => (
              <div key={item.title} className="rounded-[1.5rem] border border-white/8 bg-white/[0.03] p-5">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <item.icon className="h-5 w-5" />
                </div>
                <p className="font-display text-xl font-medium">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
