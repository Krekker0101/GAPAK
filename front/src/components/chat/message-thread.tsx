import { MessageAttachment } from "@/components/chat/message-attachment";
import { formatRelativeTime, cn } from "@/shared/lib/utils";
import type { MessageResponse } from "@/shared/types/chat";
import { Badge } from "@/shared/ui/badge";

function messageLabel(message: MessageResponse, isMine: boolean) {
  if (isMine) {
    return "You";
  }
  return `Participant ${message.senderId.slice(0, 6)}`;
}

function messageBody(message: MessageResponse) {
  const text = message.ciphertext.trim();
  if (text) {
    return text;
  }
  if (message.attachments && message.attachments.length > 0) {
    return "Sent an attachment";
  }
  return "Message";
}

export function MessageThread({
  messages,
  currentUserId,
}: {
  messages: MessageResponse[];
  currentUserId?: string | null;
}) {
  return (
    <div className="space-y-4">
      {messages.map((message) => {
        const isMine = currentUserId === message.senderId;
        const attachments = message.attachments ?? [];
        const hasAttachments = attachments.length > 0;

        return (
          <article key={message.id} className={cn("flex", isMine ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[min(100%,48rem)]", isMine ? "items-end" : "items-start")}>
              <div className={cn("mb-2 flex items-center gap-2 text-xs text-muted-foreground", isMine ? "justify-end" : "justify-start")}>
                <span className="font-medium">{messageLabel(message, isMine)}</span>
                <span className="text-white/20">·</span>
                <time dateTime={message.sentAt} className="text-white/40">{formatRelativeTime(message.sentAt)}</time>
                {message.envelopeType !== "TEXT" ? <Badge variant="trusted" className="text-[10px] px-1.5 py-0.5 rounded-full">{message.envelopeType.toLowerCase()}</Badge> : null}
              </div>
              <div
                className={cn(
                  "rounded-2xl border px-5 py-3.5 text-sm leading-6 shadow-xl transition-all duration-300 hover:scale-[1.01]",
                  isMine
                    ? "rounded-br-lg border-primary/30 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-primary/20"
                    : "rounded-bl-lg border-white/15 bg-gradient-to-br from-white/[0.08] to-white/[0.02] text-foreground shadow-black/20",
                )}
              >
                <p className="whitespace-pre-wrap break-words">{messageBody(message)}</p>
                {hasAttachments ? (
                  <div className="mt-3 space-y-2">
                    {attachments.map((attachment) => (
                      <MessageAttachment key={attachment.mediaFileId} attachment={attachment} />
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
