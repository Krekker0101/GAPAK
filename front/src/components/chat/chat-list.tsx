import Link from "next/link";

import type { ChatResponse } from "@/shared/types/chat";
import { Card } from "@/shared/ui/card";
import { formatRelativeTime } from "@/shared/lib/utils";

export function ChatList({ chats }: { chats: ChatResponse[] }) {
  return (
    <div className="space-y-3">
      {chats.map((chat) => (
        <Link key={chat.id} href={`/chats/${chat.id}`}>
          <Card className="p-5 transition hover:border-primary/30">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-xl font-semibold">Dialog {chat.id.slice(0, 8)}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Participants: {chat.participantIds.length} | Created {formatRelativeTime(chat.createdAt)}
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                {chat.lastMessageAt ? formatRelativeTime(chat.lastMessageAt) : "No messages yet"}
              </p>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
