import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { ProtectedRoute } from "@/features/auth/components/protected-route";
import { PresenceSync } from "@/features/presence/components/presence-sync";

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <PresenceSync />
      <AppShell>{children}</AppShell>
    </ProtectedRoute>
  );
}
