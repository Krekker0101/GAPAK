"use client";

import Link from "next/link";
import { CirclePlus } from "lucide-react";

import { initials } from "@/features/feed/lib/home-dashboard";
import type { ProfileResponse } from "@/shared/types/user";
import { Avatar, AvatarFallback } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";

export function QuickComposer({ profile }: { profile: ProfileResponse }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <Avatar className="h-12 w-12 border border-primary/20">
          <AvatarFallback>{initials(profile.displayName)}</AvatarFallback>
        </Avatar>
        <Button asChild variant="outline" className="h-12 flex-1 justify-start rounded-full px-5 text-muted-foreground">
          <Link href="/posts/new">Что нового, {profile.displayName}?</Link>
        </Button>
        <Button asChild className="hidden h-12 rounded-full sm:inline-flex">
          <Link href="/posts/new">
            <CirclePlus className="h-4 w-4" />
            Пост
          </Link>
        </Button>
      </div>
    </Card>
  );
}
