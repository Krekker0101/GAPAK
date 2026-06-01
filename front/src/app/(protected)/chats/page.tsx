"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { ChatList } from "@/components/chat/chat-list";
import { EmptyState } from "@/components/common/empty-state";
import { FormField } from "@/components/common/form-field";
import { PageHeader } from "@/components/common/page-header";
import { StateCard } from "@/components/common/state-card";
import { createDirectChatSchema } from "@/features/chat/schemas/message.schemas";
import { useAsyncResource } from "@/shared/lib/hooks/use-async-resource";
import { chatService } from "@/shared/api/services/chat.service";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";

type CreateDirectValues = z.infer<typeof createDirectChatSchema>;

export default function ChatsPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { data, isLoading, isError, error, reload } = useAsyncResource(() => chatService.listChats(), []);

  const form = useForm<CreateDirectValues>({
    resolver: zodResolver(createDirectChatSchema),
    defaultValues: {
      participantUserId: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      const chat = await chatService.createDirect(values);
      router.push(`/chats/${chat.id}`);
    } catch (submitError) {
      setSubmitError(submitError instanceof Error ? submitError.message : "Unable to create dialog");
    }
  });

  if (isError) {
    return (
      <StateCard
        title="Unable to load chats"
        description={error?.message ?? "Chat list request failed."}
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
    return <StateCard title="Loading chats" description="Rehydrating your private dialog list." />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Private chats"
        title="Dialogs and secure envelopes"
        description="Chats are aligned with your backend encrypted-envelope contract, including direct chat creation and message storage."
      />

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          {data.length === 0 ? (
            <EmptyState title="No dialogs yet" description="Create a direct chat by entering the participant UUID." />
          ) : (
            <ChatList chats={data} />
          )}
        </div>

        <Card className="p-6">
          <p className="text-xs uppercase tracking-[0.28em] text-primary">New direct dialog</p>
          <h2 className="mt-4 font-display text-3xl font-semibold">Create or reuse a secure chat</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            The backend expects a real participant UUID, so this form is already wired for the actual direct-chat endpoint.
          </p>
          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <FormField label="Participant user ID" error={form.formState.errors.participantUserId?.message}>
              <Input placeholder="user uuid" {...form.register("participantUserId")} />
            </FormField>
            {submitError ? <p className="text-sm text-red-300">{submitError}</p> : null}
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Opening dialog..." : "Open direct chat"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
