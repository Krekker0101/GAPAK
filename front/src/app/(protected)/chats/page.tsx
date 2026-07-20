"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Search, Plus, Send, Paperclip, RefreshCw } from "lucide-react";

import { ChatList } from "@/components/chat/chat-list";
import { MessageThread } from "@/components/chat/message-thread";
import { EmptyState } from "@/components/common/empty-state";
import { FormField } from "@/components/common/form-field";
import { StateCard } from "@/components/common/state-card";
import { createDirectChatSchema, sendMessageSchema } from "@/features/chat/schemas/message.schemas";
import { useAuthStore } from "@/features/auth/store/auth-store";
import { useAsyncResource } from "@/shared/lib/hooks/use-async-resource";
import { chatService } from "@/shared/api/services/chat.service";
import { mediaService } from "@/shared/api/services/media.service";
import { toSentenceCase } from "@/shared/lib/utils";
import type { ChatResponse, MessageResponse } from "@/shared/types/chat";
import type { PresenceResponse } from "@/shared/types/presence";
import { Tooltip } from "@/shared/ui/tooltip";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Avatar, AvatarFallback } from "@/shared/ui/avatar";
import { Badge } from "@/shared/ui/badge";
import { presenceService } from "@/shared/api/services/presence.service";

type CreateDirectValues = z.infer<typeof createDirectChatSchema>;
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

function extractMessageFromEvent(event: any): MessageResponse | null {
  if (event.eventType !== "chat.message.sent") {
    return null;
  }
  const payload = event.payload.message;
  if (!payload || typeof payload !== "object") {
    return null;
  }
  return payload as MessageResponse;
}

export default function ChatsPage() {
  const router = useRouter();
  const authUser = useAuthStore((state) => state.user);
  const [selectedChat, setSelectedChat] = useState<ChatResponse | null>(null);
  const [messages, setMessages] = useState<MessageResponse[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [presenceMap, setPresenceMap] = useState<Record<string, PresenceResponse>>({});
  const [showNewChatForm, setShowNewChatForm] = useState(false);
  const lastSequenceRef = useRef(0);

  const { data: chats, isLoading: isLoadingChats, isError: isChatsError, error: chatsError, reload: reloadChats } = useAsyncResource(() => chatService.listChats(), []);

  const createForm = useForm<CreateDirectValues>({
    resolver: zodResolver(createDirectChatSchema),
    defaultValues: {
      participantUserId: "",
    },
  });

  const messageForm = useForm<SendMessageValues>({
    resolver: zodResolver(sendMessageSchema),
    defaultValues: {
      body: "",
    },
  });

  const participantIds = selectedChat?.participantIds.filter((id) => id !== authUser?.id) ?? [];
  const participantPresence = participantIds.map((id) => presenceMap[id]).filter(Boolean);

  // Load messages when chat is selected
  const { data: messagesData, isLoading: isLoadingMessages, reload: reloadMessages } = useAsyncResource(
    async () => {
      if (!selectedChat) return null;
      return chatService.getMessages(selectedChat.id, { page: 1, limit: 50 });
    },
    [selectedChat?.id],
  );

  // Load presence for participants
  useEffect(() => {
    if (!participantIds.length) {
      setPresenceMap({});
      return;
    }

    let cancelled = false;

    const loadPresence = async () => {
      try {
        const statuses = await presenceService.query({ userIds: participantIds });
        if (cancelled) return;
        setPresenceMap(
          statuses.reduce<Record<string, PresenceResponse>>((acc, status) => {
            acc[status.userId] = status;
            return acc;
          }, {}),
        );
      } catch {
        if (!cancelled) setPresenceMap({});
      }
    };

    void loadPresence();
    const intervalId = window.setInterval(() => void loadPresence(), 5000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [participantIds]);

  // Poll for new messages
  useEffect(() => {
    if (!selectedChat) return;

    let cancelled = false;

    const pollEvents = async () => {
      try {
        const events = await chatService.getEvents(selectedChat.id, {
          after: lastSequenceRef.current,
          limit: 25,
        });
        if (cancelled || events.length === 0) return;

        lastSequenceRef.current = events[events.length - 1]?.sequence ?? lastSequenceRef.current;
        setMessages((current) =>
          events.reduce((acc, event) => {
            const nextMessage = extractMessageFromEvent(event);
            return nextMessage ? upsertMessage(acc, nextMessage) : acc;
          }, current),
        );
      } catch {
        // Continue with existing messages
      }
    };

    void pollEvents();
    const intervalId = window.setInterval(() => void pollEvents(), 4000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [selectedChat]);

  // Update messages when data changes
  useEffect(() => {
    if (messagesData) {
      setMessages(messagesData);
      lastSequenceRef.current = 0;
    }
  }, [messagesData]);

  const handleCreateChat = createForm.handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      const chat = await chatService.createDirect(values);
      setShowNewChatForm(false);
      createForm.reset();
      setSelectedChat(chat);
      reloadChats();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Unable to create dialog");
    }
  });

  const handleSendMessage = messageForm.handleSubmit(async (values) => {
    if (!selectedChat) return;
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

      const response = await chatService.sendMessage(selectedChat.id, {
        clientMessageId: createClientMessageId(),
        envelopeType,
        ciphertext: body || "",
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
      messageForm.reset({ body: "" });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Unable to send message");
    }
  });

  if (isChatsError) {
    return (
      <StateCard
        title="Unable to load chats"
        description={chatsError?.message ?? "Chat list request failed."}
        variant="error"
        action={<Button onClick={() => void reloadChats()} variant="outline">Retry</Button>}
      />
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Left Panel - Chat List */}
      <div className="glass-panel flex w-80 flex-col rounded-[2rem] overflow-hidden">
        {/* User Header */}
        <div className="border-b border-white/10 p-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback>{authUser?.displayName?.slice(0, 2).toUpperCase() ?? "GA"}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white">{authUser?.displayName ?? "User"}</p>
              <p className="text-xs text-muted-foreground truncate">@{authUser?.login ?? "user"}</p>
            </div>
            <Tooltip content="New chat">
              <Button size="icon" variant="ghost" onClick={() => setShowNewChatForm(true)} className="h-9 w-9 rounded-full">
                <Plus className="h-4 w-4" />
              </Button>
            </Tooltip>
          </div>
          
          {/* Search */}
          <div className="mt-3 relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search chats..." className="h-9 rounded-full border-white/10 bg-white/[0.04] pl-9" />
          </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto p-2">
          {isLoadingChats ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">Loading...</div>
          ) : !chats || chats.length === 0 ? (
            <EmptyState title="No chats yet" description="Create a chat to start messaging" />
          ) : (
            <ChatList chats={chats} selectedChatId={selectedChat?.id} onSelectChat={setSelectedChat} />
          )}
        </div>

        {/* New Chat Form */}
        {showNewChatForm && (
          <div className="border-t border-white/10 p-4">
            <form onSubmit={handleCreateChat} className="space-y-3">
              <FormField label="User ID" error={createForm.formState.errors.participantUserId?.message}>
                <Input placeholder="Enter user ID..." {...createForm.register("participantUserId")} />
              </FormField>
              {submitError && <p className="text-sm text-red-300">{submitError}</p>}
              <div className="flex gap-2">
                <Button type="submit" disabled={createForm.formState.isSubmitting} className="flex-1">
                  {createForm.formState.isSubmitting ? "Creating..." : "Create"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowNewChatForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Right Panel - Chat Detail */}
      <div className="glass-panel flex-1 flex flex-col rounded-[2rem] overflow-hidden">
        {!selectedChat ? (
          <div className="flex items-center justify-center h-full">
            <EmptyState title="Select a chat" description="Choose a conversation from the list to start messaging" />
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="border-b border-white/10 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>{selectedChat.id.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-white">{selectedChat.type === "DIRECT" ? "Direct Chat" : "Group Chat"}</p>
                    <div className="flex items-center gap-2 mt-1">
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
                          className="text-xs"
                        >
                          {toSentenceCase(presence.state)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <Tooltip content="Refresh">
                  <Button size="icon" variant="ghost" onClick={() => void reloadMessages()} className="h-9 w-9 rounded-full">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </Tooltip>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4">
              {isLoadingMessages ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">Loading messages...</div>
              ) : messages.length === 0 ? (
                <EmptyState title="No messages yet" description="Send the first message to start the conversation" />
              ) : (
                <MessageThread currentUserId={authUser?.id} messages={messages} />
              )}
            </div>

            {/* Message Input */}
            <div className="border-t border-white/10 p-4">
              <form onSubmit={handleSendMessage} className="space-y-3">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Textarea
                      rows={2}
                      placeholder="Type a message..."
                      {...messageForm.register("body")}
                      className="resize-none rounded-[1rem]"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Tooltip content="Attach file">
                      <Button type="button" size="icon" variant="outline" onClick={() => document.getElementById("file-input")?.click()} className="h-10 w-10 rounded-full">
                        <Paperclip className="h-4 w-4" />
                      </Button>
                    </Tooltip>
                    <input
                      id="file-input"
                      type="file"
                      accept="image/png,image/jpeg,image/webp,application/pdf"
                      className="hidden"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                    />
                    <Button type="submit" disabled={messageForm.formState.isSubmitting} className="h-10 w-10 rounded-full">
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {selectedFile && (
                  <div className="flex items-center gap-2 p-2 rounded-[1rem] border border-white/10 bg-white/[0.04]">
                    <Paperclip className="h-4 w-4 text-primary" />
                    <span className="text-sm flex-1 truncate">{selectedFile.name}</span>
                    <Button type="button" size="icon" variant="ghost" onClick={() => setSelectedFile(null)} className="h-6 w-6 rounded-full">
                      ×
                    </Button>
                  </div>
                )}
                {submitError && <p className="text-sm text-red-300">{submitError}</p>}
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
