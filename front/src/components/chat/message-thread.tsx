import { MessageAttachment } from "@/components/chat/message-attachment";
import type { MessageResponse } from "@/shared/types/chat";
import { Card } from "@/shared/ui/card";
import { formatDateTime } from "@/shared/lib/utils";

export function MessageThread({
  messages,
  currentUserId,
}: {
  messages: MessageResponse[];
  currentUserId?: string | null;
}) {
  return (
    <div className="space-y-3">
      {messages.map((message) => (
        <Card
          key={message.id}
          className={currentUserId === message.senderId ? "border-primary/20 bg-primary/[0.04] p-5" : "p-5"}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-lg font-semibold">
                {currentUserId === message.senderId ? "You" : "Participant"} · {message.envelopeType}
              </p>
              <p className="text-sm text-muted-foreground">Sender {message.senderId}</p>
            </div>
            <p className="text-xs text-muted-foreground">{formatDateTime(message.sentAt)}</p>
          </div>
          <div className="mt-4 grid gap-3 rounded-[1.25rem] border border-white/8 bg-black/20 p-4 text-sm">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Message payload</p>
              <p className="mt-2 whitespace-pre-wrap break-words text-foreground/90">{message.ciphertext}</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Nonce</p>
                <p className="mt-2 break-all text-foreground/90">{message.nonce}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Sender key</p>
                <p className="mt-2 break-all text-foreground/90">{message.senderKeyId}</p>
              </div>
            </div>
            {message.attachments && message.attachments.length > 0 ? (
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Attachments</p>
                {message.attachments.map((attachment) => (
                  <MessageAttachment key={attachment.mediaFileId} attachment={attachment} />
                ))}
              </div>
            ) : null}
          </div>
        </Card>
      ))}
    </div>
  );
}
