"use client";

import { useCallback, useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

import { Card } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import { localizePath } from "@/shared/i18n/config";
import { useI18n } from "@/shared/i18n/provider";
import { useAuthStore } from "@/features/auth/store/auth-store";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { locale } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.accessToken);
  const bootstrapping = useAuthStore((state) => state.bootstrapping);
  const bootstrap = useAuthStore((state) => state.bootstrap);

  const ensureSession = useCallback(async () => {
    const restored = await bootstrap();
    if (!restored) {
      router.replace(`${localizePath("/login", locale)}?next=${encodeURIComponent(pathname)}`);
    }
  }, [bootstrap, locale, pathname, router]);

  useEffect(() => {
    if (!accessToken && !bootstrapping) {
      void ensureSession();
    }
  }, [accessToken, bootstrapping, ensureSession]);

  if (!accessToken) {
    return (
      <div className="space-y-4">
        <Card className="p-6">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="mt-4 h-4 w-80" />
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </div>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
