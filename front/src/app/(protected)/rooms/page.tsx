"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { EmptyState } from "@/components/common/empty-state";
import { FormField } from "@/components/common/form-field";
import { PageHeader } from "@/components/common/page-header";
import { StateCard } from "@/components/common/state-card";
import { TrustRoomCard } from "@/components/rooms/trust-room-card";
import { createRoomSchema } from "@/features/rooms/schemas/room.schemas";
import { roomService } from "@/shared/api/services/room.service";
import { useAsyncResource } from "@/shared/lib/hooks/use-async-resource";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Switch } from "@/shared/ui/switch";
import { Textarea } from "@/shared/ui/textarea";

type CreateRoomValues = z.infer<typeof createRoomSchema>;

export default function RoomsPage() {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { data, isLoading, isError, error, reload } = useAsyncResource(() => roomService.listRooms(), []);

  const form = useForm<CreateRoomValues>({
    resolver: zodResolver(createRoomSchema),
    defaultValues: {
      name: "",
      description: "",
      visibility: "SECRET",
      accessMode: "INVITE_ONLY",
      requireTwoFactor: true,
      minAccountAgeDays: 30,
      messageRetentionDays: 90,
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await roomService.create({
        name: values.name,
        description: values.description || undefined,
        visibility: values.visibility,
        accessMode: values.accessMode,
        requireTwoFactor: values.requireTwoFactor,
        minAccountAgeDays: values.minAccountAgeDays,
        messageRetentionDays: values.messageRetentionDays,
      });
      form.reset({
        name: "",
        description: "",
        visibility: "SECRET",
        accessMode: "INVITE_ONLY",
        requireTwoFactor: true,
        minAccountAgeDays: 30,
        messageRetentionDays: 90,
      });
      await reload();
    } catch (submitError) {
      setSubmitError(submitError instanceof Error ? submitError.message : "Unable to create room");
    }
  });

  if (isError) {
    return (
      <StateCard
        title="Unable to load trust rooms"
        description={error?.message ?? "Trust room list request failed."}
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
    return <StateCard title="Loading trust rooms" description="Opening the spaces available to your current identity layer." />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Trust rooms"
        title="Build high-trust spaces with their own rules"
        description="Rooms carry their own visibility mode, approval flow, 2FA posture, and retention horizon."
      />

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          {data.length === 0 ? (
            <EmptyState title="No trust rooms yet" description="Create your first private or secret room." />
          ) : (
            data.map((room) => <TrustRoomCard key={room.id} room={room} />)
          )}
        </div>

        <Card className="p-6">
          <p className="text-xs uppercase tracking-[0.28em] text-primary">Create room</p>
          <h2 className="mt-4 font-display text-3xl font-semibold">Launch a trusted environment</h2>
          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <FormField label="Room name" error={form.formState.errors.name?.message}>
              <Input {...form.register("name")} />
            </FormField>
            <FormField label="Description" error={form.formState.errors.description?.message}>
              <Textarea rows={4} {...form.register("description")} />
            </FormField>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Visibility">
                <Select value={form.watch("visibility")} onValueChange={(value) => form.setValue("visibility", value as CreateRoomValues["visibility"])}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select visibility" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SECRET">Secret</SelectItem>
                    <SelectItem value="PRIVATE">Private</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Access mode">
                <Select value={form.watch("accessMode")} onValueChange={(value) => form.setValue("accessMode", value as CreateRoomValues["accessMode"])}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select access mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INVITE_ONLY">Invite only</SelectItem>
                    <SelectItem value="REQUEST">Request</SelectItem>
                    <SelectItem value="OWNER_APPROVAL">Owner approval</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Minimum account age (days)">
                <Input
                  type="number"
                  {...form.register("minAccountAgeDays", {
                    valueAsNumber: true,
                  })}
                />
              </FormField>
              <FormField label="Retention days">
                <Input
                  type="number"
                  {...form.register("messageRetentionDays", {
                    setValueAs: (value) => (value === "" ? null : Number(value)),
                  })}
                />
              </FormField>
            </div>
            <div className="flex items-center justify-between rounded-[1.5rem] border border-white/8 bg-black/20 px-4 py-3">
              <div>
                <p className="text-sm font-medium">Require 2FA</p>
                <p className="text-xs leading-6 text-muted-foreground">Harden room membership posture from day one.</p>
              </div>
              <Switch checked={form.watch("requireTwoFactor")} onCheckedChange={(checked) => form.setValue("requireTwoFactor", checked)} />
            </div>
            {submitError ? <p className="text-sm text-red-300">{submitError}</p> : null}
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Creating..." : "Create room"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
