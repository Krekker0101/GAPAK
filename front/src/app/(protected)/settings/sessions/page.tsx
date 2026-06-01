"use client";

import { useState } from "react";
import { Laptop } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { StateCard } from "@/components/common/state-card";
import { SessionCard } from "@/components/security/session-card";
import { sessionService } from "@/shared/api/services/session.service";
import { useAsyncResource } from "@/shared/lib/hooks/use-async-resource";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";

export default function SessionsPage() {
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const { data, isLoading, isError, error, reload } = useAsyncResource(() => sessionService.listSessions(), []);

  const revokeOne = async (sessionId: string) => {
    setActionError(null);
    setActionMessage(null);
    try {
      await sessionService.revokeSession(sessionId);
      setActionMessage("Session revoked.");
      await reload();
    } catch (actionError) {
      setActionError(actionError instanceof Error ? actionError.message : "Unable to revoke session");
    }
  };

  const revokeOthers = async () => {
    setActionError(null);
    setActionMessage(null);
    try {
      await sessionService.revokeOthers();
      setActionMessage("All other sessions were revoked.");
      await reload();
    } catch (actionError) {
      setActionError(actionError instanceof Error ? actionError.message : "Unable to revoke sessions");
    }
  };

  if (isError) {
    return (
      <StateCard
        title="Unable to load sessions"
        description={error?.message ?? "Session list request failed."}
        variant="error"
        action={
          <Button onClick={() => void reload()} variant="outline">
            Retry
          </Button>
        }
      />
    );
  }

  if (isLoading || !data) {
    return <StateCard title="Loading sessions" description="Checking active devices and current session posture." />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Sessions"
        title="Manage devices and revoke access"
        description="Every listed device comes from the backend session module and can be revoked individually or in bulk."
        actions={
          <Button variant="outline" onClick={() => void revokeOthers()}>
            Revoke other sessions
          </Button>
        }
      />

      <Card className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Laptop className="h-5 w-5" />
          </div>
          <div className="space-y-2">
            <p className="font-display text-2xl font-semibold">Live session control</p>
            <p className="text-sm leading-7 text-muted-foreground">
              Access token stays in memory, refresh remains cookie-friendly, and device revocation happens through the dedicated session service.
            </p>
            {actionMessage ? <p className="text-sm text-emerald-300">{actionMessage}</p> : null}
            {actionError ? <p className="text-sm text-red-300">{actionError}</p> : null}
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        {data.map((session) => (
          <SessionCard key={session.id} session={session} onRevoke={(sessionId) => void revokeOne(sessionId)} />
        ))}
      </div>
    </div>
  );
}
