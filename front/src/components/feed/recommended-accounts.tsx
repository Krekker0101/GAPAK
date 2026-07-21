"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import type { ProfileResponse } from "@/shared/types/user";

function initials(name: string) {
  return name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "U";
}

export function RecommendedAccounts({ currentProfile, users }: { currentProfile: ProfileResponse; users: ProfileResponse[] }) {
  const otherUsers = users.filter((u) => u.id !== currentProfile.id);

  return (
    <Card className="space-y-3 p-4">
      <div>
        <h3 className="text-xs font-semibold">Suggested</h3>
        <p className="text-xs text-muted-foreground">Popular accounts</p>
      </div>

      {otherUsers.length === 0 ? (
        <p className="text-xs text-muted-foreground">No suggestions</p>
      ) : (
        <div className="space-y-2">
          {otherUsers.slice(0, 5).map((user) => (
            <div key={user.id} className="flex items-center justify-between gap-2 p-2 hover:bg-white/[0.04] rounded-lg transition">
              <div className="flex min-w-0 items-center gap-2">
                <Avatar className="h-9 w-9 flex-shrink-0">
                  <AvatarFallback className="text-xs font-semibold">{initials(user.displayName)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold">{user.displayName}</p>
                  <p className="truncate text-xs text-muted-foreground">@{user.username}</p>
                </div>
              </div>
              <Button size="sm" variant="default" className="flex-shrink-0 rounded-full text-xs h-7 px-3">
                Follow
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
