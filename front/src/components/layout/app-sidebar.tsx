"use client";

import { useState, type ComponentType, memo, useCallback, useMemo } from "react";
import { usePathname } from "next/navigation";
import {
  Bell,
  Bookmark,
  CirclePlus,
  FolderKanban,
  Home,
  MessageSquare,
  Search,
  Settings,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";

import { Tooltip } from "@/shared/ui/tooltip";
import { LocaleLink } from "@/shared/i18n/locale-link";
import { stripLocaleFromPath } from "@/shared/i18n/config";
import { cn } from "@/shared/lib/utils";

type NavigationItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

function useCleanPathname() {
  const pathname = usePathname();
  return stripLocaleFromPath(pathname);
}

function isActivePath(pathname: string, href: string) {
  return pathname === href || (href !== "/feed" && pathname.startsWith(`${href}/`));
}

const NavItem = memo(function NavItem({ item, collapsed }: { item: NavigationItem; collapsed: boolean }) {
  const cleanPathname = useCleanPathname();
  const active = isActivePath(cleanPathname, item.href);

  return (
    <Tooltip content={item.label} side="right" delay={150}>
      <LocaleLink
        href={item.href}
        className={cn(
          "group relative flex items-center justify-center overflow-hidden rounded-lg p-2 transition duration-200",
          active ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-white/[0.05] hover:text-foreground",
        )}
      >
        <item.icon className="relative h-4 w-4 shrink-0" />
      </LocaleLink>
    </Tooltip>
  );
});

export const AppSidebar = memo(function AppSidebar() {
  const navigation: NavigationItem[] = useMemo(() => [
    { href: "/feed", label: "Главная", icon: Home },
    { href: "/feed", label: "Поиск", icon: Search },
    { href: "/chats", label: "Чаты", icon: MessageSquare },
    { href: "/settings/security", label: "Уведомления", icon: Bell },
    { href: "/profile", label: "Профиль", icon: UserRound },
    { href: "/rooms", label: "Мои группы", icon: Users },
    { href: "/admin/builder", label: "Мои проекты", icon: FolderKanban },
    { href: "/rooms", label: "Друзья", icon: Users },
    { href: "/profile", label: "Закладки", icon: Bookmark },
    { href: "/settings/privacy", label: "Настройки", icon: Settings },
  ], []);

  return (
    <aside className="glass-panel sticky top-4 hidden h-[calc(100vh-2rem)] shrink-0 rounded-[1rem] p-2 lg:flex lg:flex-col w-16">
      <div className="mb-4 flex items-center justify-center">
        <Tooltip content="Gapak" side="right" delay={150}>
          <div className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-primary/20 text-primary font-semibold transition hover:scale-105">
            G
          </div>
        </Tooltip>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto">
        {navigation.map((item) => <NavItem key={`${item.label}-${item.href}`} item={item} collapsed={true} />)}
      </div>

      <div className="mt-2">
        <Tooltip content="Защита активна" side="right" delay={150}>
          <LocaleLink href="/settings/security" className="flex items-center justify-center rounded-lg border border-emerald-300/15 bg-emerald-300/10 p-2 text-emerald-100 transition hover:bg-emerald-300/15">
            <ShieldCheck className="h-4 w-4" />
          </LocaleLink>
        </Tooltip>
      </div>
    </aside>
  );
});

export const AppMobileNav = memo(function AppMobileNav() {
  const cleanPathname = useCleanPathname();
  const items: NavigationItem[] = useMemo(() => [
    { href: "/feed", label: "Главная", icon: Home },
    { href: "/chats", label: "Чаты", icon: MessageSquare },
    { href: "/posts/new", label: "Создать", icon: CirclePlus },
    { href: "/rooms", label: "Группы", icon: Users },
    { href: "/profile", label: "Профиль", icon: UserRound },
  ], []);

  return (
    <nav className="fixed inset-x-3 bottom-3 z-40 rounded-[1rem] border border-white/10 bg-background/90 p-2 shadow-2xl shadow-black/40 backdrop-blur-2xl lg:hidden">
      <div className="grid grid-cols-5 gap-1">
        {items.map((item) => {
          const active = isActivePath(cleanPathname, item.href);
          return (
            <Tooltip key={item.href} content={item.label} side="top" delay={150}>
              <LocaleLink href={item.href} className={cn("flex min-h-10 items-center justify-center rounded-lg px-1 transition", active ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground")} aria-label={item.label}>
                <item.icon className="h-4 w-4" />
              </LocaleLink>
            </Tooltip>
          );
        })}
      </div>
    </nav>
  );
});
