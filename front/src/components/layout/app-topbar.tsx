"use client";

import { Search, Shield, LogOut } from "lucide-react";

import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { Avatar, AvatarFallback } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { LocaleLink } from "@/shared/i18n/locale-link";
import { useI18n } from "@/shared/i18n/provider";
import { useAuthStore } from "@/features/auth/store/auth-store";

export function AppTopbar() {
  const { t } = useI18n();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  return (
    <div className="glass-panel relative overflow-hidden rounded-[2rem] p-4 sm:flex sm:items-center sm:justify-between">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(102,244,255,0.12),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(255,178,244,0.1),_transparent_28%)]" />
      <div className="relative w-full max-w-xl">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder={t("topbar.searchPlaceholder")} className="pl-11" />
      </div>
      <div className="relative mt-4 flex flex-wrap items-center gap-3 sm:mt-0">
        <LanguageSwitcher compact />
        <LocaleLink
          href="/settings/security"
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <Shield className="h-4 w-4 text-primary" />
          {t("topbar.securityDashboard")}
        </LocaleLink>
        <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 backdrop-blur-xl">
          <Avatar className="h-9 w-9">
            <AvatarFallback>{user?.displayName?.slice(0, 2).toUpperCase() ?? "GA"}</AvatarFallback>
          </Avatar>
          <div className="hidden sm:block">
            <p className="text-sm font-medium">{user?.displayName ?? t("topbar.privateUser")}</p>
            <p className="text-xs text-muted-foreground">@{user?.username ?? "gapak"}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => void logout()}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
