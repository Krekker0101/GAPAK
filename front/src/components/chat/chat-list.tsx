import type { ChatResponse } from "@/shared/types/chat";
import { Card } from "@/shared/ui/card";
import { formatRelativeTime } from "@/shared/lib/utils";
import { Avatar, AvatarFallback } from "@/shared/ui/avatar";
import { cn } from "@/shared/lib/utils";

export function ChatList({ chats, selectedChatId, onSelectChat }: { chats: ChatResponse[]; selectedChatId?: string; onSelectChat: (chat: ChatResponse) => void }) {
  return (
    <div className="space-y-2">
      {chats.map((chat) => (
        <Card
          key={chat.id}
          onClick={() => onSelectChat(chat)}
          className={cn(
            "p-4 cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:border-primary/40 hover:bg-gradient-to-r hover:from-primary/10 hover:to-transparent",
            selectedChatId === chat.id && "border-primary/60 bg-gradient-to-r from-primary/20 to-primary/5 shadow-lg shadow-primary/20"
          )}
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar className="h-11 w-11 shrink-0 ring-2 ring-white/10 ring-offset-2 ring-offset-black">
                <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-white font-bold text-sm">{chat.id.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              {chat.lastMessageAt && (
                <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-black" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white text-sm truncate">
                {chat.type === "DIRECT" ? `Dialog ${chat.id.slice(0, 8)}` : `Group ${chat.id.slice(0, 8)}`}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {chat.participantIds.length} participant{chat.participantIds.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <p className="text-xs text-muted-foreground shrink-0">
                {chat.lastMessageAt ? formatRelativeTime(chat.lastMessageAt) : "No messages"}
              </p>
              {selectedChatId === chat.id && (
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
