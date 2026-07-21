import { ArrowRight, ShieldCheck, TimerReset, Users } from "lucide-react";

import { LocaleLink } from "@/shared/i18n/locale-link";
import type { TrustRoomResponse } from "@/shared/types/room";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { formatDateTime, toSentenceCase } from "@/shared/lib/utils";

export function TrustRoomCard({ room }: { room: TrustRoomResponse }) {
  return (
    <Card className="social-card trust-glow space-y-4 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="trusted">{toSentenceCase(room.visibility)}</Badge>
            <Badge variant="default">{toSentenceCase(room.accessMode)}</Badge>
            {room.requireTwoFactor ? <Badge variant="success">2FA</Badge> : null}
          </div>
          <h3 className="mt-4 truncate font-display text-2xl font-semibold">{room.name}</h3>
        </div>
        {room.requireTwoFactor ? (
          <div className="rounded-2xl bg-emerald-300/10 p-3 text-emerald-200">
            <ShieldCheck className="h-5 w-5" />
          </div>
        ) : null}
      </div>

      <p className="text-sm leading-7 text-muted-foreground">
        {room.description || "Private room without a public-facing description yet."}
      </p>

      <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
        <span className="inline-flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Owner {room.ownerId.slice(0, 8)}
        </span>
        <span className="inline-flex items-center gap-2">
          <TimerReset className="h-4 w-4 text-primary" />
          Retention {room.messageRetentionDays ?? "Custom"} days
        </span>
        <span>{room.expiresAt ? `Expires ${formatDateTime(room.expiresAt)}` : `Created ${formatDateTime(room.createdAt)}`}</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-4">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">High-trust space</p>
        <Button asChild size="sm">
          <LocaleLink href={`/rooms/${room.id}`}>
            Enter room
            <ArrowRight className="h-4 w-4" />
          </LocaleLink>
        </Button>
      </div>
    </Card>
  );
}
