import type { ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

type FormFieldProps = {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
};

export function FormField({ label, hint, error, children, className }: FormFieldProps) {
  return (
    <label className={cn("space-y-2.5", className)}>
      <div className="space-y-1">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {hint ? <p className="text-xs leading-5 text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </label>
  );
}
