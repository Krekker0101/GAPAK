import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/shared/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border border-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] backdrop-blur-md",
  {
    variants: {
      variant: {
        default: "bg-white/[0.05] text-foreground",
        primary: "bg-primary/12 text-primary",
        trusted: "bg-violet-300/10 text-violet-200",
        success: "bg-emerald-400/10 text-emerald-300",
        danger: "bg-red-400/10 text-red-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

type BadgeProps = HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
