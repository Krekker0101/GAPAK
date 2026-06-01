import { ShieldCheck, TimerReset, Users } from "lucide-react";

import type { TrustRoomResponse } from "@/shared/types/room";
import { Badge } from "@/shared/ui/badge";
import { Card } from "@/shared/ui/card";
import { formatDateTime, toSentenceCase } from "@/shared/lib/utils";

export function TrustRoomCard({ room }: { room: TrustRoomResponse }) {
  return (
    <Card className="trust-glow space-y-4 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="trusted">{toSentenceCase(room.visibility)}</Badge>
            <Badge variant="default">{toSentenceCase(room.accessMode)}</Badge>
          </div>
          <h3 className="mt-4 font-display text-2xl font-semibold">{room.name}</h3>
        </div>
        {room.requireTwoFactor ? (
          <div className="rounded-2xl bg-emerald-300/10 p-3 text-emerald-200">
            <ShieldCheck className="h-5 w-5" />
          </div>
        ) : null}
      </div>
      <p className="text-sm leading-7 text-muted-foreground">{room.description || "Private room without a public-facing description yet."}</p>
      <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
        <span className="inline-flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Owner {room.ownerId.slice(0, 8)}
        </span>
        <span className="inline-flex items-center gap-2">
          <TimerReset className="h-4 w-4 text-primary" />
          Retention {room.messageRetentionDays ?? "Custom"} days
        </span>
        <span>Created {formatDateTime(room.createdAt)}</span>
      </div>
    </Card>
  );
}
