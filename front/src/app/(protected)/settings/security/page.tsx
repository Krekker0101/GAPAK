"use client";

import { useState } from "react";
import { BellRing, CircleAlert, ShieldAlert } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { FormField } from "@/components/common/form-field";
import { PageHeader } from "@/components/common/page-header";
import { StateCard } from "@/components/common/state-card";
import { SignalCard } from "@/components/security/signal-card";
import { panicModeSchema } from "@/features/security/schemas/security.schemas";
import { useAuthStore } from "@/features/auth/store/auth-store";
import { securityService } from "@/shared/api/services/security.service";
import { useAsyncResource } from "@/shared/lib/hooks/use-async-resource";
import { formatDateTime, toSentenceCase } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Switch } from "@/shared/ui/switch";

type PanicValues = z.infer<typeof panicModeSchema>;

export default function SecuritySettingsPage() {
  const currentSessionId = useAuthStore((state) => state.session?.id);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const { data, isLoading, isError, error, reload } = useAsyncResource(async () => {
    const [auditEvents, alerts, flags] = await Promise.all([
      securityService.getAuditEvents(),
      securityService.getAlerts(),
      securityService.getFlags(),
    ]);
    return { auditEvents, alerts, flags };
  }, []);

  const form = useForm<PanicValues>({
    resolver: zodResolver(panicModeSchema),
    defaultValues: {
      preserveCurrentSession: true,
      currentSessionId: currentSessionId ?? "",
      reason: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    setSubmitMessage(null);
    try {
      const result = await securityService.panicMode({
        preserveCurrentSession: values.preserveCurrentSession,
        currentSessionId: values.currentSessionId || undefined,
        reason: values.reason,
      });
      setSubmitMessage(`Panic mode accepted. Revoked ${result.revokedSessionCount} sessions and ${result.revokedGrantCount} grants.`);
      await reload();
    } catch (submitError) {
      setSubmitError(submitError instanceof Error ? submitError.message : "Unable to activate panic mode");
    }
  });

  if (isError) {
    return (
      <StateCard
        title="Unable to load security dashboard"
        description={error?.message ?? "Security request failed."}
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
    return <StateCard title="Loading security dashboard" description="Collecting audit events, device alerts, and suspicious activity." />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Security"
        title="Security dashboard and panic mode"
        description="A premium control room for audit trails, suspicious flags, device alerts, and emergency lockdown."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <SignalCard
          title={`${data.flags.length} suspicious flags`}
          subtitle="Backend-generated security signals with severity and review lifecycle."
          meta="Suspicious activity"
          icon={<ShieldAlert className="h-5 w-5" />}
        />
        <SignalCard
          title={`${data.alerts.length} device alerts`}
          subtitle="Recent device login or session alerts routed through the dedicated security module."
          meta="Device posture"
          icon={<CircleAlert className="h-5 w-5" />}
        />
        <SignalCard
          title={`${data.auditEvents.length} audit events`}
          subtitle="Every sensitive action can be surfaced here without breaking the privacy model."
          meta="Audit stream"
          icon={<BellRing className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="p-6">
          <p className="text-xs uppercase tracking-[0.28em] text-destructive">Emergency control</p>
          <h2 className="mt-4 font-display text-3xl font-semibold">Trigger panic mode</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Revoke sessions, grants, and pending uploads through the backend security endpoint when the account posture becomes sensitive.
          </p>
          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <div className="flex items-center justify-between rounded-[1.5rem] border border-white/8 bg-black/20 px-4 py-3">
              <div>
                <p className="text-sm font-medium">Preserve current session</p>
                <p className="text-xs leading-6 text-muted-foreground">Keep this device alive while revoking others.</p>
              </div>
              <Switch
                checked={form.watch("preserveCurrentSession")}
                onCheckedChange={(checked) => form.setValue("preserveCurrentSession", checked)}
              />
            </div>
            <FormField label="Current session ID" error={form.formState.errors.currentSessionId?.message}>
              <Input {...form.register("currentSessionId")} />
            </FormField>
            <FormField label="Reason" error={form.formState.errors.reason?.message}>
              <Input placeholder="Suspicious login from an unknown device" {...form.register("reason")} />
            </FormField>
            {submitMessage ? <p className="text-sm text-emerald-300">{submitMessage}</p> : null}
            {submitError ? <p className="text-sm text-red-300">{submitError}</p> : null}
            <Button type="submit" variant="destructive" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Locking down..." : "Activate panic mode"}
            </Button>
          </form>
        </Card>

        <div className="space-y-4">
          <Card className="p-6">
            <p className="text-xs uppercase tracking-[0.28em] text-primary">Recent alerts</p>
            <div className="mt-4 space-y-3">
              {data.alerts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No device alerts right now.</p>
              ) : (
                data.alerts.map((alert) => (
                  <div key={alert.id} className="rounded-[1.25rem] border border-white/8 bg-black/20 p-4">
                    <p className="font-medium text-foreground">{toSentenceCase(alert.channel)} | {toSentenceCase(alert.status)}</p>
                    <p className="mt-2 text-sm text-muted-foreground">Session {alert.sessionId}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">{formatDateTime(alert.createdAt)}</p>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="p-6">
            <p className="text-xs uppercase tracking-[0.28em] text-primary">Audit stream</p>
            <div className="mt-4 space-y-3">
              {data.auditEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No audit events yet.</p>
              ) : (
                data.auditEvents.slice(0, 5).map((event) => (
                  <div key={event.id} className="rounded-[1.25rem] border border-white/8 bg-black/20 p-4">
                    <p className="font-medium text-foreground">{toSentenceCase(event.action)}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {toSentenceCase(event.resourceType)} | {event.severity}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">{formatDateTime(event.createdAt)}</p>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
