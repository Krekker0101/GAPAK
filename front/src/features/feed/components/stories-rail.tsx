"use client";

import Link from "next/link";
import { Plus } from "lucide-react";

import { initials, shortId } from "@/features/feed/lib/home-dashboard";
import { useMediaUrl } from "@/shared/lib/hooks/use-media-url";
import type { StoryResponse } from "@/shared/types/story";
import type { ProfileResponse } from "@/shared/types/user";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";

function StoryAvatar({ story, isMine }: { story: StoryResponse; isMine: boolean }) {
  const { url } = useMediaUrl(story.mediaFileId, "story-ring-preview");

  return (
    <button type="button" className="group min-w-[88px] text-left" aria-label={`Открыть историю ${shortId(story.id)}`}>
      <div className="relative mx-auto h-[76px] w-[76px] rounded-full bg-[linear-gradient(135deg,rgba(102,244,255,0.95),rgba(138,125,255,0.86),rgba(255,255,255,0.58))] p-[2px] shadow-[0_0_32px_rgba(102,244,255,0.18)] transition duration-300 group-hover:scale-105">
        <div className="h-full w-full overflow-hidden rounded-full border-2 border-background bg-card">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="Story" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_30%_20%,rgba(102,244,255,0.22),rgba(138,125,255,0.16))] text-xs font-semibold text-white">
              {isMine ? "Вы" : initials(story.authorId)}
            </div>
          )}
        </div>
        <span className="absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-background bg-emerald-300" />
      </div>
      <p className="mt-2 truncate text-center text-xs text-muted-foreground">{isMine ? "Моя история" : `user:${shortId(story.authorId)}`}</p>
    </button>
  );
}

export function StoriesRail({ profile, stories }: { profile: ProfileResponse; stories: StoryResponse[] }) {
  const myStories = stories.filter((story) => story.authorId === profile.id);
  const otherStories = stories.filter((story) => story.authorId !== profile.id);
  const orderedStories = [...myStories, ...otherStories];

  return (
    <Card className="overflow-hidden p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-primary/90">Live stories</p>
          <h2 className="font-display text-xl font-semibold">Истории из Backend API</h2>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/posts/new">
            <Plus className="h-4 w-4" />
            Загрузить
          </Link>
        </Button>
      </div>
      {orderedStories.length === 0 ? (
        <div className="rounded-[1.5rem] border border-dashed border-white/12 bg-white/[0.025] p-6 text-sm text-muted-foreground">
          Активных историй нет. После публикации через backend API они появятся здесь автоматически.
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {orderedStories.map((story) => (
            <StoryAvatar key={story.id} story={story} isMine={story.authorId === profile.id} />
          ))}
        </div>
      )}
    </Card>
  );
}
