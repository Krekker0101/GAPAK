"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ArrowLeft, ShieldCheck, Users, WandSparkles } from "lucide-react";

import { FormField } from "@/components/common/form-field";
import { PageHeader } from "@/components/common/page-header";
import { StateCard } from "@/components/common/state-card";
import { roomService } from "@/shared/api/services/room.service";
import { useAsyncResource } from "@/shared/lib/hooks/use-async-resource";
import { LocaleLink } from "@/shared/i18n/locale-link";
import { Avatar, AvatarFallback } from "@/shared/ui/avatar";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { formatDateTime, formatRelativeTime, initials, toSentenceCase } from "@/shared/lib/utils";
import type { TrustRoomRole } from "@/shared/types/room";

const inviteSchema = z.object({
  userId: z.string().uuid("Enter a valid user ID"),
  role: z.enum(["OWNER", "ADMIN", "MODERATOR", "MEMBER", "AUDITOR"] as const),
});

type InviteValues = z.infer<typeof inviteSchema>;

export default function RoomDetailPage() {
  const params = useParams<{ roomId: string }>();
  const roomId = params.roomId;
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { data, isLoading, isError, error, reload } = useAsyncResource(() => roomService.getRoom(roomId as string), [roomId]);

  const inviteForm = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      userId: "",
      role: "MEMBER",
    },
  });

  const visibleMembers = useMemo(() => data?.members ?? [], [data]);

  const submitInvite = inviteForm.handleSubmit(async (values) => {
    setSubmitError(null);
    setSuccess(null);
    try {
      await roomService.addMember(roomId as string, values);
      setSuccess("Member added successfully.");
      inviteForm.reset({ userId: "", role: "MEMBER" });
      await reload();
    } catch (caught) {
      setSubmitError(caught instanceof Error ? caught.message : "Unable to add member");
    }
  });

  if (isError) {
    return (
      <StateCard
        title="Room unavailable"
        description={error?.message ?? "The requested room is not accessible."}
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
    return <StateCard title="Loading room" description="Opening the room from Backend API." />;
  }

  const room = data.room;
  const canInvite = data.currentUserRole === "OWNER" || data.currentUserRole === "ADMIN";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Trust room"
        title={room.name}
        description={room.description || "A secure, high-trust room managed directly by the backend."}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="trusted">{toSentenceCase(room.visibility)}</Badge>
        <Badge variant="default">{toSentenceCase(room.accessMode)}</Badge>
        <Badge variant="primary">Role: {data.currentUserRole}</Badge>
        <Badge variant="success">{data.memberCount} members</Badge>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Room overview</p>
                <h2 className="mt-3 font-display text-3xl font-semibold">Private space with live access rules</h2>
              </div>
              {room.requireTwoFactor ? (
                <div className="rounded-2xl bg-emerald-300/10 p-3 text-emerald-600">
                  <ShieldCheck className="h-5 w-5" />
                </div>
              ) : null}
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-[1.5rem] border border-white/8 bg-background/35 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Owner</p>
                <p className="mt-2 text-sm font-medium">{room.ownerId.slice(0, 8)}</p>
              </div>
              <div className="rounded-[1.5rem] border border-white/8 bg-background/35 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Retention</p>
                <p className="mt-2 text-sm font-medium">{room.messageRetentionDays ?? "Custom"} days</p>
              </div>
              <div className="rounded-[1.5rem] border border-white/8 bg-background/35 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Updated</p>
                <p className="mt-2 text-sm font-medium">{formatRelativeTime(room.updatedAt)}</p>
              </div>
              <div className="rounded-[1.5rem] border border-white/8 bg-background/35 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Expires</p>
                <p className="mt-2 text-sm font-medium">{room.expiresAt ? formatDateTime(room.expiresAt) : "No limit"}</p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild>
                <LocaleLink href="/rooms">
                  <ArrowLeft className="h-4 w-4" />
                  Back to rooms
                </LocaleLink>
              </Button>
              <Button asChild variant="outline">
                <LocaleLink href="/posts/new">
                  <WandSparkles className="h-4 w-4" />
                  Create room post
                </LocaleLink>
              </Button>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Members</p>
                <h3 className="mt-2 font-display text-2xl font-semibold">Room participants</h3>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="h-4 w-4" />
                <span className="text-sm">{data.memberCount}</span>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {visibleMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No members were returned by the backend.</p>
              ) : (
                visibleMembers.map((member) => (
                  <div key={member.userId} className="flex items-center justify-between gap-4 rounded-[1.4rem] border border-white/8 bg-background/35 p-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-11 w-11">
                        <AvatarFallback>{initials(member.displayName || member.username)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{member.displayName || member.username}</p>
                        <p className="text-xs text-muted-foreground">@{member.username}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="default">{member.role}</Badge>
                      <p className="mt-2 text-xs text-muted-foreground">Joined {formatRelativeTime(member.joinedAt)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Security posture</p>
                <h3 className="mt-2 font-display text-2xl font-semibold">Room trust controls</h3>
              </div>
              <Badge variant="success">Live</Badge>
            </div>
            <div className="mt-5 space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-background/35 px-4 py-3">
                <span className="text-muted-foreground">Two-factor protection</span>
                <span>{room.requireTwoFactor ? "Enabled" : "Disabled"}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-background/35 px-4 py-3">
                <span className="text-muted-foreground">Access mode</span>
                <span>{room.accessMode}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-background/35 px-4 py-3">
                <span className="text-muted-foreground">Created</span>
                <span>{formatDateTime(room.createdAt)}</span>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Admin tools</p>
                <h3 className="mt-2 font-display text-2xl font-semibold">Invite a new member</h3>
              </div>
            </div>

            {canInvite ? (
              <form className="mt-6 space-y-4" onSubmit={submitInvite}>
                <FormField label="User ID" error={inviteForm.formState.errors.userId?.message}>
                  <Input placeholder="uuid" {...inviteForm.register("userId")} />
                </FormField>

                <FormField label="Role" error={inviteForm.formState.errors.role?.message}>
                  <Select value={inviteForm.watch("role")} onValueChange={(value) => inviteForm.setValue("role", value as TrustRoomRole)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OWNER">Owner</SelectItem>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                      <SelectItem value="MODERATOR">Moderator</SelectItem>
                      <SelectItem value="MEMBER">Member</SelectItem>
                      <SelectItem value="AUDITOR">Auditor</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>

                {submitError ? <p className="text-sm text-red-500">{submitError}</p> : null}
                {success ? <p className="text-sm text-emerald-600">{success}</p> : null}

                <Button type="submit" disabled={inviteForm.formState.isSubmitting}>
                  {inviteForm.formState.isSubmitting ? "Adding..." : "Add member"}
                </Button>
              </form>
            ) : (
              <p className="mt-4 rounded-2xl border border-white/8 bg-background/35 p-4 text-sm text-muted-foreground">
                Only owners and admins can invite new members into this room.
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
