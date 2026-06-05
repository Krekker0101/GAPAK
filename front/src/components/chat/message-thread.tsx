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
    <div className="space-y-3">
      {messages.map((message) => {
        const isMine = currentUserId === message.senderId;
        const attachments = message.attachments ?? [];
        const hasAttachments = attachments.length > 0;

        return (
          <article key={message.id} className={cn("flex", isMine ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[min(100%,44rem)]", isMine ? "items-end" : "items-start")}>
              <div className={cn("mb-1 flex items-center gap-2 text-xs text-muted-foreground", isMine ? "justify-end" : "justify-start")}>
                <span>{messageLabel(message, isMine)}</span>
                <span>·</span>
                <time dateTime={message.sentAt}>{formatRelativeTime(message.sentAt)}</time>
                {message.envelopeType !== "TEXT" ? <Badge variant="trusted">{message.envelopeType.toLowerCase()}</Badge> : null}
              </div>
              <div
                className={cn(
                  "rounded-[1.35rem] border px-4 py-3 text-sm leading-6 shadow-lg shadow-black/10",
                  isMine
                    ? "rounded-br-md border-primary/20 bg-primary text-primary-foreground"
                    : "rounded-bl-md border-white/10 bg-white/[0.05] text-foreground",
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
