"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { FormField } from "@/components/common/form-field";
import { PageHeader } from "@/components/common/page-header";
import { StateCard } from "@/components/common/state-card";
import { privacySchema } from "@/features/privacy/schemas/privacy.schemas";
import { useAsyncResource } from "@/shared/lib/hooks/use-async-resource";
import { userService } from "@/shared/api/services/user.service";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Switch } from "@/shared/ui/switch";

type PrivacyValues = z.infer<typeof privacySchema>;

const whoSeesWhat = [
  ["Profile surface", "Controlled by profile visibility and discoverability toggles."],
  ["Presence / last seen", "Controlled independently from public profile presentation."],
  ["Default post policy", "Pre-fills new post visibility but can be overridden on creation."],
  ["Invites and requests", "Friend requests and trusted invites can be enabled separately."],
];

export default function PrivacySettingsPage() {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const { data, isLoading, isError, error, reload } = useAsyncResource(() => userService.getMe(), []);

  const form = useForm<PrivacyValues>({
    resolver: zodResolver(privacySchema),
    defaultValues: {
      profileVisibility: "TRUSTED_ONLY",
      lastSeenVisibility: "CONNECTIONS",
      allowFriendRequests: true,
      allowTrustedInvites: true,
      searchableByEmail: false,
      searchableByUsername: true,
      postDefaultPrivacy: "TRUSTED_CIRCLE",
      showOnlineStatus: false,
    },
  });

  useEffect(() => {
    if (data) {
      form.reset(data.privacy);
    }
  }, [data, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    setSubmitMessage(null);
    try {
      await userService.updatePrivacy(values);
      setSubmitMessage("Privacy settings updated.");
      await reload();
    } catch (submitError) {
      setSubmitError(submitError instanceof Error ? submitError.message : "Unable to update privacy");
    }
  });

  if (isError) {
    return (
      <StateCard
        title="Unable to load privacy settings"
        description={error?.message ?? "Privacy request failed."}
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
    return <StateCard title="Loading privacy settings" description="Restoring your trust-aware visibility controls." />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Privacy"
        title="Who sees what"
        description="Central control for profile visibility, discoverability, online status, post defaults, and incoming trust edges."
      />

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="p-6">
          <p className="text-xs uppercase tracking-[0.28em] text-primary">Visibility model</p>
          <div className="mt-5 space-y-3">
            {whoSeesWhat.map(([title, description]) => (
              <div key={title} className="rounded-[1.25rem] border border-white/8 bg-black/20 p-4">
                <p className="font-medium text-foreground">{title}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <form className="space-y-5" onSubmit={onSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Profile visibility">
                <Select
                  value={form.watch("profileVisibility")}
                  onValueChange={(value) => form.setValue("profileVisibility", value as PrivacyValues["profileVisibility"])}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select visibility" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PUBLIC">Public</SelectItem>
                    <SelectItem value="CONNECTIONS">Connections</SelectItem>
                    <SelectItem value="TRUSTED_ONLY">Trusted only</SelectItem>
                    <SelectItem value="PRIVATE">Private</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Last seen visibility">
                <Select
                  value={form.watch("lastSeenVisibility")}
                  onValueChange={(value) => form.setValue("lastSeenVisibility", value as PrivacyValues["lastSeenVisibility"])}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select last seen policy" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EVERYONE">Everyone</SelectItem>
                    <SelectItem value="CONNECTIONS">Connections</SelectItem>
                    <SelectItem value="NOBODY">Nobody</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            </div>
            <FormField label="Default post privacy">
              <Select
                value={form.watch("postDefaultPrivacy")}
                onValueChange={(value) => form.setValue("postDefaultPrivacy", value as PrivacyValues["postDefaultPrivacy"])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select default post privacy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PUBLIC">Public</SelectItem>
                  <SelectItem value="FRIENDS">Friends</SelectItem>
                  <SelectItem value="TRUSTED_CIRCLE">Trusted circle</SelectItem>
                  <SelectItem value="PRIVATE">Private</SelectItem>
                  <SelectItem value="ONE_TIME">One-time</SelectItem>
                  <SelectItem value="TIMED">Timed</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <div className="grid gap-3">
              {[
                ["allowFriendRequests", "Allow friend requests", "New connection requests can reach the account."],
                ["allowTrustedInvites", "Allow trusted invites", "Trusted-circle invitations can be sent to this identity layer."],
                ["searchableByEmail", "Searchable by email", "The account can be discovered through email-based lookups."],
                ["searchableByUsername", "Searchable by username", "The account can be discovered through username search."],
                ["showOnlineStatus", "Show online status", "Allowed audience can see presence in real time."],
              ].map(([name, label, hint]) => (
                <div key={name} className="flex items-center justify-between rounded-[1.5rem] border border-white/8 bg-black/20 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs leading-6 text-muted-foreground">{hint}</p>
                  </div>
                  <Switch
                    checked={form.watch(name as keyof PrivacyValues) as boolean}
                    onCheckedChange={(checked) => form.setValue(name as keyof PrivacyValues, checked as never)}
                  />
                </div>
              ))}
            </div>
            {submitMessage ? <p className="text-sm text-emerald-300">{submitMessage}</p> : null}
            {submitError ? <p className="text-sm text-red-300">{submitError}</p> : null}
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Saving..." : "Save privacy settings"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
