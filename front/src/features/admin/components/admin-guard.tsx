"use client";

import type { ReactNode } from "react";
import { ShieldAlert } from "lucide-react";

import { useAuthStore } from "@/features/auth/store/auth-store";
import { useI18n } from "@/shared/i18n/provider";
import { Card } from "@/shared/ui/card";

export function AdminGuard({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const user = useAuthStore((state) => state.user);

  if (user?.role !== "ADMIN") {
    return (
      <Card className="flex min-h-[420px] flex-col items-center justify-center text-center">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/12 text-destructive">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h1 className="font-display text-3xl font-semibold">{t("admin.forbiddenTitle")}</h1>
        <p className="mt-3 max-w-lg text-sm leading-7 text-muted-foreground">{t("admin.forbiddenText")}</p>
      </Card>
    );
  }

  return <>{children}</>;
}
