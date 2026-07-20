import * as React from "react";

import { cn } from "@/shared/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(({ className, ...props }, ref) => {
  return (
    <input
      className={cn(
        "flex w-full min-h-[56px] rounded-2xl border border-white/8 bg-white/[0.85] px-4 py-3 text-sm text-foreground outline-none backdrop-blur-md transition duration-300 placeholder:text-muted-foreground/70 focus:border-primary/70 focus:bg-white/[0.95] focus:ring-0",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});

Input.displayName = "Input";

export { Input };
