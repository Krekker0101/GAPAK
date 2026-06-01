import { Laptop2, ShieldCheck, Smartphone, Trash2 } from "lucide-react";

import type { SessionResponse } from "@/shared/types/session";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { formatDateTime, formatRelativeTime } from "@/shared/lib/utils";

export function SessionCard({
  session,
  onRevoke,
  disabled,
}: {
  session: SessionResponse;
  onRevoke: (sessionId: string) => void;
  disabled?: boolean;
}) {
  const DeviceIcon = session.userAgent?.toLowerCase().includes("mobile") ? Smartphone : Laptop2;

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-primary">
            <DeviceIcon className="h-5 w-5" />
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-display text-xl font-semibold">{session.deviceName || "Unknown device"}</p>
              {session.isCurrent ? <Badge variant="success">Current session</Badge> : null}
              <Badge variant="default">{session.securityLevel}</Badge>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">{session.userAgent || "User agent not retained"}</p>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span>Last used {formatRelativeTime(session.lastUsedAt)}</span>
              <span>Created {formatDateTime(session.createdAt)}</span>
              <span>Expires {formatDateTime(session.expiresAt)}</span>
            </div>
          </div>
        </div>
        {!session.isCurrent ? (
          <Button variant="outline" onClick={() => onRevoke(session.id)} disabled={disabled}>
            <Trash2 className="h-4 w-4" />
            Revoke
          </Button>
        ) : (
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-300/10 px-4 py-2 text-sm text-emerald-200">
            <ShieldCheck className="h-4 w-4" />
            Active on this device
          </div>
        )}
      </div>
    </Card>
  );
}
