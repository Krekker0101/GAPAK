"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Paperclip, RefreshCw, Send } from "lucide-react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { MessageThread } from "@/components/chat/message-thread";
import { EmptyState } from "@/components/common/empty-state";
import { FormField } from "@/components/common/form-field";
import { PageHeader } from "@/components/common/page-header";
import { StateCard } from "@/components/common/state-card";
import { sendMessageSchema } from "@/features/chat/schemas/message.schemas";
import { useAuthStore } from "@/features/auth/store/auth-store";
import { chatService } from "@/shared/api/services/chat.service";
import { mediaService } from "@/shared/api/services/media.service";
import { presenceService } from "@/shared/api/services/presence.service";
import { useAsyncResource } from "@/shared/lib/hooks/use-async-resource";
import { toSentenceCase } from "@/shared/lib/utils";
import type { ChatEventResponse, MessageResponse } from "@/shared/types/chat";
import type { PresenceResponse } from "@/shared/types/presence";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";

type SendMessageValues = z.infer<typeof sendMessageSchema>;

function createClientMessageId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `msg-${Date.now()}`;
}

function createNonce() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `nonce-${Date.now()}`;
}

function upsertMessage(messages: MessageResponse[], nextMessage: MessageResponse) {
  const existingIndex = messages.findIndex(
    (message) => message.id === nextMessage.id || message.clientMessageId === nextMessage.clientMessageId,
  );
  if (existingIndex === -1) {
    return [...messages, nextMessage].sort(
      (left, right) => new Date(left.sentAt).getTime() - new Date(right.sentAt).getTime(),
    );
  }

  const cloned = [...messages];
  cloned[existingIndex] = nextMessage;
  return cloned;
}

function extractMessageFromEvent(event: ChatEventResponse): MessageResponse | null {
  if (event.eventType !== "chat.message.sent") {
    return null;
  }

  const payload = event.payload.message;
  if (!payload || typeof payload !== "object") {
    return null;
  }

  return payload as MessageResponse;
}

export default function ChatDetailsPage() {
  const params = useParams<{ chatId: string }>();
  const chatId = params.chatId;
  const authUser = useAuthStore((state) => state.user);
  const [messages, setMessages] = useState<MessageResponse[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [presenceMap, setPresenceMap] = useState<Record<string, PresenceResponse>>({});
  const lastSequenceRef = useRef(0);

  const { data, isLoading, isError, error, reload } = useAsyncResource(async () => {
    const [loadedMessages, chats] = await Promise.all([
      chatService.getMessages(chatId, { page: 1, limit: 50 }),
      chatService.listChats(),
    ]);

    return {
      messages: loadedMessages,
      chat: chats.find((item) => item.id === chatId) ?? null,
    };
  }, [chatId]);

  const participantIds = useMemo(() => {
    return (data?.chat?.participantIds ?? []).filter((participantId) => participantId !== authUser?.id);
  }, [authUser?.id, data?.chat?.participantIds]);

  const participantPresence = participantIds.map((participantId) => presenceMap[participantId]).filter(Boolean);

  const form = useForm<SendMessageValues>({
    resolver: zodResolver(sendMessageSchema),
    defaultValues: {
      body: "",
    },
  });

  useEffect(() => {
    lastSequenceRef.current = 0;
  }, [chatId]);

  useEffect(() => {
    if (!data?.messages) {
      return;
    }

    setMessages(data.messages);
  }, [data?.messages]);

  useEffect(() => {
    if (!participantIds.length) {
      setPresenceMap({});
      return;
    }

    let cancelled = false;

    const loadPresence = async () => {
      try {
        const statuses = await presenceService.query({
          userIds: participantIds,
        });
        if (cancelled) {
          return;
        }
        setPresenceMap(
          statuses.reduce<Record<string, PresenceResponse>>((accumulator, status) => {
            accumulator[status.userId] = status;
            return accumulator;
          }, {}),
        );
      } catch {
        if (!cancelled) {
          setPresenceMap({});
        }
      }
    };

    void loadPresence();
    const intervalId = window.setInterval(() => {
      void loadPresence();
    }, 5_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [participantIds]);

  useEffect(() => {
    if (!data) {
      return;
    }

    let cancelled = false;

    const pollEvents = async () => {
      try {
        const events = await chatService.getEvents(chatId, {
          after: lastSequenceRef.current,
          limit: 25,
        });
        if (cancelled || events.length === 0) {
          return;
        }

        lastSequenceRef.current = events[events.length - 1]?.sequence ?? lastSequenceRef.current;
        setMessages((current) =>
          events.reduce((accumulator, event) => {
            const nextMessage = extractMessageFromEvent(event);
            return nextMessage ? upsertMessage(accumulator, nextMessage) : accumulator;
          }, current),
        );
      } catch {
        // Message history remains available even if event polling hiccups.
      }
    };

    void pollEvents();
    const intervalId = window.setInterval(() => {
      void pollEvents();
    }, 4_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [chatId, data]);

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    const body = values.body?.trim() ?? "";

    if (!body && !selectedFile) {
      setSubmitError("Enter a message or attach a file before sending.");
      return;
    }

    try {
      let attachmentManifest: Record<string, unknown> | undefined;
      let envelopeType: MessageResponse["envelopeType"] = "TEXT";

      if (selectedFile) {
        const upload = await mediaService.uploadFile(selectedFile, "CHAT_ATTACHMENT");
        attachmentManifest = {
          attachments: [
            {
              mediaId: upload.mediaFileId,
              fileName: selectedFile.name,
              mimeType: selectedFile.type || "application/octet-stream",
              sizeBytes: selectedFile.size,
            },
          ],
        };
        envelopeType = "ATTACHMENT";
      }

      const response = await chatService.sendMessage(chatId, {
        clientMessageId: createClientMessageId(),
        envelopeType,
        ciphertext: body || `Attachment: ${selectedFile?.name ?? "file"}`,
        nonce: createNonce(),
        senderKeyId: "gapak-web",
        attachmentManifest,
        metadata: {
          source: "web.chat",
          transport: "durable-events",
        },
      });

      setMessages((current) => upsertMessage(current, response));
      setSelectedFile(null);
      form.reset({
        body: "",
      });
    } catch (submitError) {
      setSubmitError(submitError instanceof Error ? submitError.message : "Unable to send message");
    }
  });

  if (isError) {
    return (
      <StateCard
        title="Unable to load chat"
        description={error?.message ?? "Message list request failed."}
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
    return <StateCard title="Loading messages" description="Restoring the current thread, participants, and live delivery stream." />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Secure thread"
        title={`Dialog ${chatId.slice(0, 8)}`}
        description="Messages load from persisted history, new deliveries arrive through durable chat events, and presence is refreshed continuously."
        actions={
          participantPresence.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {participantPresence.map((presence) => (
                <Badge
                  key={presence.userId}
                  variant={
                    presence.state === "ONLINE"
                      ? "success"
                      : presence.state === "IDLE"
                        ? "trusted"
                        : presence.state === "HIDDEN"
                          ? "danger"
                          : "default"
                  }
                >
                  {presence.userId.slice(0, 6)} · {toSentenceCase(presence.state)}
                </Badge>
              ))}
            </div>
          ) : undefined
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div>
          {messages.length === 0 ? (
            <EmptyState title="No messages yet" description="Send the first message or attachment to initialize the thread." />
          ) : (
            <MessageThread currentUserId={authUser?.id} messages={messages} />
          )}
        </div>

        <Card className="p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-primary">Composer</p>
              <h2 className="mt-4 font-display text-3xl font-semibold">Send a private message</h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                Files upload through the shared media API, messages persist immediately, and the active thread refreshes through event polling after reconnects.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={() => void reload()}>
              <RefreshCw className="h-4 w-4" />
              Reload
            </Button>
          </div>

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <FormField label="Message">
              <Textarea rows={7} placeholder="Write something private..." {...form.register("body")} />
            </FormField>
            <FormField label="Attachment">
              <div className="space-y-3">
                <Input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                />
                {selectedFile ? (
                  <div className="rounded-[1.15rem] border border-white/8 bg-black/20 p-3 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Paperclip className="h-4 w-4 text-primary" />
                      <span className="font-medium text-foreground">{selectedFile.name}</span>
                    </div>
                    <p className="mt-2">
                      {(selectedFile.size / 1024).toFixed(1)} KB · {selectedFile.type || "application/octet-stream"}
                    </p>
                  </div>
                ) : null}
              </div>
            </FormField>
            {submitError ? <p className="text-sm text-red-300">{submitError}</p> : null}
            <Button type="submit" disabled={form.formState.isSubmitting}>
              <Send className="h-4 w-4" />
              {form.formState.isSubmitting ? "Sending..." : "Send message"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
