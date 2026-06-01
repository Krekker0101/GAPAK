import type { ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("glass-panel relative overflow-hidden rounded-[2rem] p-6 md:flex md:items-end md:justify-between md:p-8", className)}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(102,244,255,0.2),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(255,178,244,0.15),_transparent_24%)]" />
      <div className="relative space-y-3">
        {eyebrow ? <p className="text-[11px] uppercase tracking-[0.32em] text-primary">{eyebrow}</p> : null}
        <h1 className="font-display text-3xl font-semibold md:text-4xl">{title}</h1>
        {description ? <p className="max-w-2xl text-sm leading-7 text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="relative mt-5 flex flex-wrap items-center gap-3 md:mt-0">{actions}</div> : null}
    </div>
  );
}
