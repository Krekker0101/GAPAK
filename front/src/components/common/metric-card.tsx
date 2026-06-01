import type { ReactNode } from "react";

import { Card } from "@/shared/ui/card";

type MetricCardProps = {
  label: string;
  value: string;
  detail: string;
  icon?: ReactNode;
};

export function MetricCard({ label, value, detail, icon }: MetricCardProps) {
  return (
    <Card className="h-full p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{label}</p>
        {icon}
      </div>
      <p className="font-display text-3xl font-semibold">{value}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
    </Card>
  );
}
