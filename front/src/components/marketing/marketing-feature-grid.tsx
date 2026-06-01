"use client";

import { EyeOff, Film, Layers3, Shield, Timer, UsersRound } from "lucide-react";

import { Card } from "@/shared/ui/card";
import { useI18n } from "@/shared/i18n/provider";

export function MarketingFeatureGrid() {
  const { t } = useI18n();
  const features = [
    {
      title: t("landing.features.visibilityTitle"),
      description: t("landing.features.visibilityText"),
      icon: Layers3,
    },
    {
      title: t("landing.features.timedTitle"),
      description: t("landing.features.timedText"),
      icon: Timer,
    },
    {
      title: t("landing.features.presenceTitle"),
      description: t("landing.features.presenceText"),
      icon: EyeOff,
    },
    {
      title: t("landing.features.roomsTitle"),
      description: t("landing.features.roomsText"),
      icon: UsersRound,
    },
    {
      title: t("landing.features.deviceTitle"),
      description: t("landing.features.deviceText"),
      icon: Shield,
    },
    {
      title: t("landing.features.mediaTitle"),
      description: t("landing.features.mediaText"),
      icon: Film,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {features.map((feature) => (
        <Card key={feature.title} className="group p-6 transition hover:-translate-y-1 hover:border-primary/30">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-primary transition group-hover:bg-primary/12">
            <feature.icon className="h-5 w-5" />
          </div>
          <h3 className="font-display text-2xl font-semibold">{feature.title}</h3>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">{feature.description}</p>
        </Card>
      ))}
    </div>
  );
}
