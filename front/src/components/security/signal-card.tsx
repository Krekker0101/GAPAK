import type { ReactNode } from "react";

import { Card } from "@/shared/ui/card";

export function SignalCard({
  title,
  subtitle,
  meta,
  icon,
}: {
  title: string;
  subtitle: string;
  meta: string;
  icon: ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-primary">{icon}</div>
      <p className="font-display text-xl font-semibold">{title}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{subtitle}</p>
      <p className="mt-4 text-xs uppercase tracking-[0.24em] text-muted-foreground">{meta}</p>
    </Card>
  );
}
