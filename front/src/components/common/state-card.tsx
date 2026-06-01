import type { ReactNode } from "react";

import { AlertTriangle, LoaderCircle } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";

type StateCardProps = {
  title: string;
  description: string;
  variant?: "loading" | "error";
  action?: ReactNode;
};

export function StateCard({ title, description, variant = "loading", action }: StateCardProps) {
  const Icon = variant === "loading" ? LoaderCircle : AlertTriangle;

  return (
    <Card className="bg-black/20">
      <CardHeader>
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5">
          <Icon className={`h-5 w-5 ${variant === "loading" ? "animate-spin text-primary" : "text-destructive"}`} />
        </div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      {action ? <CardContent>{action}</CardContent> : null}
    </Card>
  );
}
