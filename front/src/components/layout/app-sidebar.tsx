"use client";

import { useState, type ComponentType } from "react";
import { usePathname } from "next/navigation";
import {
  Bell,
  Bookmark,
  CirclePlus,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  Home,
  MessageSquare,
  Search,
  Settings,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";

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

function NavItem({ item, collapsed }: { item: NavigationItem; collapsed: boolean }) {
  const cleanPathname = useCleanPathname();
  const active = isActivePath(cleanPathname, item.href);

  return (
    <LocaleLink
      href={item.href}
      title={collapsed ? item.label : undefined}
      className={cn(
        "group relative flex items-center gap-3 overflow-hidden rounded-[1.35rem] px-3 py-3 text-sm transition duration-300",
        collapsed && "justify-center",
        active ? "bg-primary/15 text-primary shadow-[inset_0_0_0_1px_rgba(102,244,255,0.16)]" : "text-muted-foreground hover:bg-white/[0.055] hover:text-foreground",
      )}
    >
      <span className={cn("absolute inset-y-2 left-0 w-1 rounded-r-full transition-all", active ? "bg-primary" : "bg-transparent group-hover:bg-primary/40")} />
      <item.icon className="relative h-5 w-5 shrink-0" />
      <span className={cn("relative truncate transition", collapsed && "sr-only")}>{item.label}</span>
    </LocaleLink>
  );
}

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const navigation: NavigationItem[] = [
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
  ];

  return (
    <aside className={cn("glass-panel sticky top-4 hidden h-[calc(100vh-2rem)] shrink-0 rounded-[2rem] p-4 transition-all duration-300 lg:flex lg:flex-col", collapsed ? "w-[92px]" : "w-[280px]") }>
      <div className={cn("mb-7 flex items-center gap-3", collapsed && "justify-center")}>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.1rem] bg-[linear-gradient(135deg,rgba(102,244,255,0.22),rgba(138,125,255,0.24))] font-display text-lg font-semibold text-primary shadow-glow">
          G
        </div>
        <div className={cn("min-w-0 transition", collapsed && "sr-only")}>
          <p className="font-display text-lg font-semibold">Gapak</p>
          <p className="truncate text-sm text-muted-foreground">Premium social</p>
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto pr-1">
        {navigation.map((item) => <NavItem key={`${item.label}-${item.href}`} item={item} collapsed={collapsed} />)}
      </div>

      <div className="mt-4 space-y-2">
        <LocaleLink href="/settings/security" className={cn("flex items-center gap-3 rounded-[1.35rem] border border-emerald-300/15 bg-emerald-300/10 px-3 py-3 text-sm text-emerald-100 transition hover:bg-emerald-300/15", collapsed && "justify-center")}>
          <ShieldCheck className="h-5 w-5" />
          <span className={cn(collapsed && "sr-only")}>Защита активна</span>
        </LocaleLink>
        <button type="button" onClick={() => setCollapsed((current) => !current)} className="flex w-full items-center justify-center gap-2 rounded-[1.35rem] border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-muted-foreground transition hover:bg-white/[0.07] hover:text-foreground" aria-label={collapsed ? "Развернуть меню" : "Свернуть меню"}>
          {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          <span className={cn(collapsed && "sr-only")}>Свернуть</span>
        </button>
      </div>
    </aside>
  );
}

export function AppMobileNav() {
  const cleanPathname = useCleanPathname();
  const items: NavigationItem[] = [
    { href: "/feed", label: "Главная", icon: Home },
    { href: "/chats", label: "Чаты", icon: MessageSquare },
    { href: "/posts/new", label: "Создать", icon: CirclePlus },
    { href: "/rooms", label: "Группы", icon: Users },
    { href: "/profile", label: "Профиль", icon: UserRound },
  ];

  return (
    <nav className="fixed inset-x-3 bottom-3 z-40 rounded-[1.5rem] border border-white/10 bg-background/90 px-2 py-2 shadow-2xl shadow-black/40 backdrop-blur-2xl lg:hidden">
      <div className="grid grid-cols-5 gap-1">
        {items.map((item) => {
          const active = isActivePath(cleanPathname, item.href);
          return (
            <LocaleLink key={item.href} href={item.href} className={cn("flex min-h-12 flex-col items-center justify-center gap-1 rounded-[1.1rem] px-1 text-[10px] font-medium transition", active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground")} aria-label={item.label}>
              <item.icon className="h-4 w-4" />
              <span className="max-w-full truncate">{item.label}</span>
            </LocaleLink>
          );
        })}
      </div>
    </nav>
  );
}
