"use client";

import type { ComponentType } from "react";
import { usePathname } from "next/navigation";
import {
  CirclePlus,
  Clapperboard,
  Home,
  LayoutDashboard,
  Lock,
  MessageSquare,
  Monitor,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";

import { useAuthStore } from "@/features/auth/store/auth-store";
import { LocaleLink } from "@/shared/i18n/locale-link";
import { stripLocaleFromPath } from "@/shared/i18n/config";
import { useI18n } from "@/shared/i18n/provider";
import { cn } from "@/shared/lib/utils";

type NavigationItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

const adminRoles = new Set(["ADMIN", "MODERATOR", "SECURITY_ANALYST"]);

function useCleanPathname() {
  const pathname = usePathname();
  return stripLocaleFromPath(pathname);
}

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavSection({ title, items }: { title: string; items: NavigationItem[] }) {
  const cleanPathname = useCleanPathname();

  return (
    <div className="space-y-2">
      <p className="px-3 text-[11px] uppercase tracking-[0.3em] text-muted-foreground">{title}</p>
      <div className="space-y-2">
        {items.map((item) => {
          const active = isActivePath(cleanPathname, item.href);
          return (
            <LocaleLink
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 overflow-hidden rounded-[1.4rem] px-3 py-3 text-sm transition duration-300",
                active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
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
  const userRole = useAuthStore((state) => state.user?.role);
  const canSeeAdmin = Boolean(userRole && adminRoles.has(userRole));
  const primaryNavigation: NavigationItem[] = [
    { href: "/feed", label: t("nav.feed"), icon: LayoutDashboard },
    { href: "/clips", label: t("nav.clips"), icon: Clapperboard },
    { href: "/chats", label: t("nav.chats"), icon: MessageSquare },
    { href: "/rooms", label: t("nav.rooms"), icon: Users },
    { href: "/profile", label: t("nav.profile"), icon: UserRound },
    { href: "/posts/new", label: t("nav.createPost"), icon: CirclePlus },
  ];
  const settingsNavigation: NavigationItem[] = [
    { href: "/settings/privacy", label: t("nav.privacy"), icon: Lock },
    { href: "/settings/security", label: t("nav.security"), icon: ShieldCheck },
    { href: "/settings/sessions", label: t("nav.sessions"), icon: Monitor },
  ];
  const adminNavigation: NavigationItem[] = [
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
          <p className="text-sm text-muted-foreground">Private social app</p>
        </div>
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto pr-1">
        <NavSection title={t("nav.workspace")} items={primaryNavigation} />
        <NavSection title={t("nav.protection")} items={settingsNavigation} />
        {canSeeAdmin ? <NavSection title={t("nav.administration")} items={adminNavigation} /> : null}
      </div>
    </aside>
  );
}

export function AppMobileNav() {
  const { t } = useI18n();
  const cleanPathname = useCleanPathname();
  const items: NavigationItem[] = [
    { href: "/feed", label: t("nav.feed"), icon: Home },
    { href: "/chats", label: t("nav.chats"), icon: MessageSquare },
    { href: "/posts/new", label: t("nav.createPost"), icon: CirclePlus },
    { href: "/rooms", label: t("nav.rooms"), icon: Users },
    { href: "/profile", label: t("nav.profile"), icon: UserRound },
  ];

  return (
    <nav className="fixed inset-x-3 bottom-3 z-40 rounded-[1.5rem] border border-white/10 bg-background/90 px-2 py-2 shadow-2xl shadow-black/40 backdrop-blur-2xl lg:hidden">
      <div className="grid grid-cols-5 gap-1">
        {items.map((item) => {
          const active = isActivePath(cleanPathname, item.href);
          return (
            <LocaleLink
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-12 flex-col items-center justify-center gap-1 rounded-[1.1rem] px-1 text-[10px] font-medium transition",
                active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
              )}
              aria-label={item.label}
            >
              <item.icon className="h-4 w-4" />
              <span className="max-w-full truncate">{item.label}</span>
            </LocaleLink>
          );
        })}
      </div>
    </nav>
  );
}
