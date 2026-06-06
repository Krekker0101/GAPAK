import type { ReactNode } from "react";

import { AppMobileNav, AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen px-4 py-4 md:px-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="ambient-orb animate-drift left-[8%] top-[10%] h-36 w-36 bg-cyan-300/20" />
        <div className="ambient-orb animate-float right-[10%] top-[16%] h-44 w-44 bg-indigo-300/12" />
        <div className="ambient-orb animate-drift bottom-[8%] left-[24%] h-40 w-40 bg-sky-300/10" />
      </div>
      <div className="mx-auto flex max-w-[1600px] gap-4">
        <AppSidebar />
        <div className="flex min-h-[calc(100vh-2rem)] flex-1 flex-col gap-4">
          <AppTopbar />
          <main className="flex-1 pb-24 lg:pb-0">{children}</main>
        </div>
        <AppMobileNav />
      </div>
    </div>
  );
}
