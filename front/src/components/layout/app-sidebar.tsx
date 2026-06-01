"use client";

import type { ComponentType } from "react";
import { usePathname } from "next/navigation";
import {
  CirclePlus,
  Clapperboard,
  LayoutDashboard,
  Lock,
  MessageSquare,
  Monitor,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";

import { LocaleLink } from "@/shared/i18n/locale-link";
import { stripLocaleFromPath } from "@/shared/i18n/config";
import { useI18n } from "@/shared/i18n/provider";
import { cn } from "@/shared/lib/utils";

function NavSection({
  title,
  items,
}: {
  title: string;
  items: { href: string; label: string; icon: ComponentType<{ className?: string }> }[];
}) {
  const pathname = usePathname();
  const cleanPathname = stripLocaleFromPath(pathname);

  return (
    <div className="space-y-2">
      <p className="px-3 text-[11px] uppercase tracking-[0.3em] text-muted-foreground">{title}</p>
      <div className="space-y-2">
        {items.map((item) => {
          const active = cleanPathname === item.href || cleanPathname.startsWith(`${item.href}/`);
          return (
            <LocaleLink
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 overflow-hidden rounded-[1.4rem] px-3 py-3 text-sm transition duration-300",
                active
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "absolute inset-y-0 left-0 w-1 rounded-r-full transition-all",
                  active ? "bg-primary" : "bg-transparent group-hover:bg-primary/40",
                )}
              />
              <item.icon className="relative h-4 w-4" />
              <span className="relative">{item.label}</span>
            </LocaleLink>
          );
        })}
      </div>
    </div>
  );
}

export function AppSidebar() {
  const { t } = useI18n();
  const primaryNavigation = [
    { href: "/feed", label: t("nav.feed"), icon: LayoutDashboard },
    { href: "/clips", label: t("nav.clips"), icon: Clapperboard },
    { href: "/profile", label: t("nav.profile"), icon: UserRound },
    { href: "/chats", label: t("nav.chats"), icon: MessageSquare },
    { href: "/rooms", label: t("nav.rooms"), icon: Users },
    { href: "/posts/new", label: t("nav.createPost"), icon: CirclePlus },
  ];
  const settingsNavigation = [
    { href: "/settings/privacy", label: t("nav.privacy"), icon: Lock },
    { href: "/settings/sessions", label: t("nav.sessions"), icon: Monitor },
    { href: "/settings/security", label: t("nav.security"), icon: ShieldCheck },
  ];
  const adminNavigation = [
    { href: "/admin", label: t("nav.dashboard"), icon: LayoutDashboard },
    { href: "/admin/builder", label: t("nav.builder"), icon: Sparkles },
  ];

  return (
    <aside className="glass-panel hidden h-[calc(100vh-2rem)] w-[280px] shrink-0 rounded-[2rem] p-5 lg:flex lg:flex-col">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-[1.1rem] bg-primary/15 font-display text-lg font-semibold text-primary shadow-glow">
          G
        </div>
        <div>
          <p className="font-display text-lg font-semibold">Gapak</p>
          <p className="text-sm text-muted-foreground">{t("nav.socialShell")}</p>
        </div>
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto pr-1">
        <NavSection title={t("nav.workspace")} items={primaryNavigation} />
        <NavSection title={t("nav.protection")} items={settingsNavigation} />
        <NavSection title={t("nav.administration")} items={adminNavigation} />
      </div>
      <div className="rounded-[1.75rem] border border-amber-200/10 bg-amber-200/5 p-4">
        <p className="text-[11px] uppercase tracking-[0.24em] text-amber-200">{t("nav.trustSignal")}</p>
        <p className="mt-3 font-display text-xl font-semibold">{t("nav.trustSignalTitle")}</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("nav.trustSignalText")}</p>
      </div>
    </aside>
  );
}
