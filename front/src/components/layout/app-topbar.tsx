"use client";

import { useState, memo, useCallback } from "react";
import { Search, Shield, LogOut, Bell, Lock } from "lucide-react";

import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { NotificationCenter } from "@/components/notification/notification-center";
import { Tooltip } from "@/shared/ui/tooltip";
import { Avatar, AvatarFallback } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { LocaleLink } from "@/shared/i18n/locale-link";
import { useI18n } from "@/shared/i18n/provider";
import { useAuthStore } from "@/features/auth/store/auth-store";
import { useWebSocketNotifications } from "@/shared/lib/hooks/use-websocket-notifications";

export const AppTopbar = memo(function AppTopbar() {
  const { t } = useI18n();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [showNotifications, setShowNotifications] = useState(false);

  const { isConnected, unreadCount } = useWebSocketNotifications({
    onNotification: (notification) => {
      console.log("New notification:", notification);
    },
  });

  const handleShowNotifications = useCallback(() => {
    setShowNotifications(true);
  }, []);

  const handleHideNotifications = useCallback(() => {
    setShowNotifications(false);
  }, []);

  const handleLogout = useCallback(() => {
    void logout();
  }, [logout]);

  return (
    <div className="glass-panel relative overflow-hidden rounded-[1rem] p-2 flex items-center justify-between">
      <div className="relative flex items-center gap-2">
        <Tooltip content="Search" side="bottom">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
            <Search className="h-4 w-4" />
          </Button>
        </Tooltip>
      </div>

      <div className="relative flex items-center gap-1">
        <ThemeToggle />
        <LanguageSwitcher compact />
        
        <Tooltip content="Security" side="bottom">
          <LocaleLink
            href="/settings/security"
            className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] p-2 text-muted-foreground transition hover:text-foreground hover:bg-white/[0.08]"
          >
            <Shield className="h-4 w-4 text-primary" />
          </LocaleLink>
        </Tooltip>
        
        <div className="relative">
          <Tooltip content="Notifications" side="bottom">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleShowNotifications}
              aria-label="Notifications"
              className="relative h-8 w-8 rounded-lg"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-[9px] font-bold">{unreadCount}</span>
                </div>
              )}
            </Button>
          </Tooltip>
          <NotificationCenter
            isOpen={showNotifications}
            onClose={handleHideNotifications}
          />
        </div>
        
        <Tooltip content="Profile" side="bottom">
          <LocaleLink href="/profile" className="flex items-center">
            <Avatar className="h-8 w-8">
              <AvatarFallback>{user?.displayName?.slice(0, 2).toUpperCase() ?? "GA"}</AvatarFallback>
            </Avatar>
          </LocaleLink>
        </Tooltip>
        
        <Tooltip content="Logout" side="bottom">
          <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Logout" className="h-8 w-8 rounded-lg">
            <LogOut className="h-4 w-4" />
          </Button>
        </Tooltip>
      </div>
    </div>
  );
});
