"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import { useMediaUrl } from "@/shared/lib/hooks/use-media-url";
import type { ProfileResponse } from "@/shared/types/user";
import type { StoryResponse } from "@/shared/types/story";
import { useState, useCallback } from "react";

const GRADIENT_RINGS = [
  "from-red-500 via-orange-500 to-yellow-500",
  "from-yellow-500 via-pink-500 to-red-500",
  "from-pink-500 via-purple-500 to-violet-500",
  "from-violet-500 to-blue-500",
  "from-blue-500 via-cyan-500 to-teal-500",
  "from-teal-500 to-emerald-500",
];

interface StoryAvatarProps {
  story: StoryResponse;
  isMine: boolean;
  index: number;
  isViewed: boolean;
  onStoryClick: (storyId: string) => void;
}

function StoryAvatar({ story, isMine, index, isViewed, onStoryClick }: StoryAvatarProps) {
  const { url } = useMediaUrl(story.mediaFileId, "story-ring-preview");
  const gradient = GRADIENT_RINGS[index % GRADIENT_RINGS.length];
  const [isHovering, setIsHovering] = useState(false);

  return (
    <button
      type="button"
      onClick={() => onStoryClick(story.id)}
      className="group relative flex flex-col items-center gap-2 focus:outline-none flex-shrink-0"
      aria-label={isMine ? "My story" : `Story from ${story.authorId}`}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Animated ring for unviewed stories */}
      {!isViewed && !isMine && (
        <div className="absolute inset-0 animate-pulse">
          <div
            className={`absolute inset-0 rounded-full bg-gradient-to-br ${gradient} opacity-50`}
            style={{ animation: "spin 3s linear infinite" }}
          />
        </div>
      )}

      {/* Main gradient ring */}
      <div
        className={`bg-gradient-to-br ${gradient} p-0.5 rounded-full transition-all duration-300 ${
          isHovering ? "scale-110" : "scale-100"
        } ${isViewed && !isMine ? "opacity-50" : ""}`}
      >
        {/* Glass effect background */}
        <div className="p-1 bg-background/80 backdrop-blur-sm rounded-full border border-white/10">
          <Avatar className="h-14 w-14 border-2 border-background ring-2 ring-white/5">
            {url && <AvatarImage src={url} alt="Story" className="object-cover" />}
            <AvatarFallback className="text-xs font-semibold bg-gradient-to-br from-primary/20 to-accent/20">
              {isMine ? "+" : story.authorId.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>

      {/* Online indicator */}
      {!isMine && (
        <div className="absolute bottom-0 right-0 h-3 w-3 bg-green-500 rounded-full border-2 border-background shadow-lg opacity-0 group-hover:opacity-100 transition-opacity" />
      )}

      {/* Label */}
      <span className="text-xs font-medium text-center text-foreground/70 group-hover:text-foreground transition-colors max-w-[60px] truncate">
        {isMine ? "Your story" : story.authorId.split("").slice(0, 1).join("").toUpperCase()}
      </span>
    </button>
  );
}

function AddStoryButton({ onCreateClick }: { onCreateClick: () => void }) {
  const [isHovering, setIsHovering] = useState(false);

  return (
    <button
      type="button"
      onClick={onCreateClick}
      className="group relative flex flex-col items-center gap-2 focus:outline-none flex-shrink-0"
      aria-label="Create story"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Gradient ring */}
      <div
        className={`bg-gradient-to-br from-primary/60 to-accent/60 p-0.5 rounded-full transition-all duration-300 ${
          isHovering ? "scale-110" : "scale-100"
        }`}
      >
        {/* Glass effect background */}
        <div className="p-1 bg-background/80 backdrop-blur-sm rounded-full border border-white/10 flex items-center justify-center">
          <div className="h-14 w-14 rounded-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20">
            <Plus className="h-6 w-6 text-primary" />
          </div>
        </div>
      </div>

      {/* Label */}
      <span className="text-xs font-medium text-center text-foreground/70 group-hover:text-foreground transition-colors">
        Add story
      </span>
    </button>
  );
}

interface StoriesRailProps {
  profile: ProfileResponse;
  stories: StoryResponse[];
  onStoryClick?: (storyId: string) => void;
  onCreateClick?: () => void;
}

export function StoriesRail({ profile, stories, onStoryClick = () => {}, onCreateClick = () => {} }: StoriesRailProps) {
  const myStories = stories.filter((story) => story.authorId === profile.id);
  const otherStories = stories.filter((story) => story.authorId !== profile.id);
  const orderedStories = [...myStories, ...otherStories];
  const [isScrolling, setIsScrolling] = useState(false);

  const handleStoryClick = useCallback(
    (storyId: string) => {
      onStoryClick(storyId);
    },
    [onStoryClick]
  );

  return (
    <div
      className="relative group"
      onMouseEnter={() => setIsScrolling(true)}
      onMouseLeave={() => setIsScrolling(false)}
    >
      {/* Premium glassmorphism background */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/5 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity" />

      {/* Scrollable container */}
      <div className="relative flex items-center gap-4 overflow-x-auto pb-2 px-1 scroll-smooth">
        {/* Add story button */}
        <AddStoryButton onCreateClick={onCreateClick} />

        {/* Stories */}
        {orderedStories.length === 0 ? (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <span>No stories yet</span>
          </div>
        ) : (
          orderedStories.map((story, index) => (
            <StoryAvatar
              key={story.id}
              story={story}
              isMine={story.authorId === profile.id}
              index={index}
              isViewed={story.isViewed ?? false}
              onStoryClick={handleStoryClick}
            />
          ))
        )}
      </div>

      {/* Scroll shadow indicators */}
      <div className="pointer-events-none absolute top-0 left-0 h-full w-8 bg-gradient-to-r from-background to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="pointer-events-none absolute top-0 right-0 h-full w-8 bg-gradient-to-l from-background to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}
