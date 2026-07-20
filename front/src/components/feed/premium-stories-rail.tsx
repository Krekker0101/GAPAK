"use client";

import { useState, memo, useCallback, useMemo } from "react";
import { Plus, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import { useMediaUrl } from "@/shared/lib/hooks/use-media-url";
import type { ProfileResponse } from "@/shared/types/user";
import type { StoryResponse } from "@/shared/types/story";

const GRADIENT_RINGS = [
  "from-red-500 via-orange-500 to-yellow-500",
  "from-yellow-500 via-pink-500 to-red-500",
  "from-pink-500 via-purple-500 to-violet-500",
  "from-violet-500 to-blue-500",
  "from-blue-500 via-cyan-500 to-teal-500",
  "from-teal-500 to-emerald-500",
];

interface PremiumStoriesRailProps {
  profile: ProfileResponse;
  stories: StoryResponse[];
  onStoryClick?: (storyId: string) => void;
  onCreateClick?: () => void;
}

const StoryAvatar = memo(function StoryAvatar({ 
  story, 
  isMine, 
  index, 
  isViewed, 
  onStoryClick 
}: { 
  story: StoryResponse; 
  isMine: boolean; 
  index: number; 
  isViewed: boolean; 
  onStoryClick: (storyId: string) => void;
}) {
  const { url } = useMediaUrl(story.mediaFileId, "story-ring-preview");
  const gradient = GRADIENT_RINGS[index % GRADIENT_RINGS.length];
  const [isHovering, setIsHovering] = useState(false);

  const handleClick = useCallback(() => {
    onStoryClick(story.id);
  }, [story.id, onStoryClick]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className="group relative flex flex-col items-center gap-2 focus:outline-none flex-shrink-0"
      aria-label={isMine ? "My story" : `Story from ${story.authorId}`}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Animated glow effect */}
      {!isViewed && !isMine && (
        <div className="absolute inset-0 animate-pulse">
          <div
            className={`absolute inset-0 rounded-full bg-gradient-to-br ${gradient} opacity-30 blur-md`}
            style={{ animation: "spin 3s linear infinite" }}
          />
        </div>
      )}

      {/* Main gradient ring with glassmorphism */}
      <div
        className={`bg-gradient-to-br ${gradient} p-[3px] rounded-full transition-all duration-500 ${
          isHovering ? "scale-110 shadow-2xl" : "scale-100 shadow-lg"
        } ${isViewed && !isMine ? "opacity-40" : ""}`}
      >
        {/* Glass effect background */}
        <div className="p-1.5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-full border-2 border-white/50 dark:border-white/10">
          <Avatar className="h-16 w-16 border-2 border-white/30 dark:border-white/10">
            {url && <AvatarImage src={url} alt="Story" className="object-cover" />}
            <AvatarFallback className="text-sm font-semibold bg-gradient-to-br from-blue-500/20 to-purple-500/20">
              {isMine ? "+" : story.authorId.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>

      {/* Online indicator */}
      {!isMine && (
        <div className="absolute bottom-2 right-2 h-3.5 w-3.5 bg-green-500 rounded-full border-2 border-white dark:border-slate-900 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      )}

      {/* Username */}
      <span className="text-xs font-medium text-center text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors max-w-[70px] truncate">
        {isMine ? "Your story" : story.authorId.slice(0, 2).toUpperCase()}
      </span>
    </button>
  );
});

const AddStoryButton = memo(function AddStoryButton({ onCreateClick }: { onCreateClick: () => void }) {
  const [isHovering, setIsHovering] = useState(false);

  const handleClick = useCallback(() => {
    onCreateClick();
  }, [onCreateClick]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className="group relative flex flex-col items-center gap-2 focus:outline-none flex-shrink-0"
      aria-label="Create story"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Gradient ring with glow */}
      <div
        className={`bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 p-[3px] rounded-full transition-all duration-500 ${
          isHovering ? "scale-110 shadow-2xl" : "scale-100 shadow-lg"
        }`}
      >
        {/* Glass effect background */}
        <div className="p-1.5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-full border-2 border-white/50 dark:border-white/10 flex items-center justify-center">
          <div className="h-16 w-16 rounded-full flex items-center justify-center bg-gradient-to-br from-blue-500/10 to-purple-500/10">
            <Plus className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
      </div>

      {/* Label */}
      <span className="text-xs font-medium text-center text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
        Add story
      </span>
    </button>
  );
});

export const PremiumStoriesRail = memo(function PremiumStoriesRail({ profile, stories, onStoryClick = () => {}, onCreateClick = () => {} }: PremiumStoriesRailProps) {
  const myStories = useMemo(() => stories.filter((story) => story.authorId === profile.id), [stories, profile.id]);
  const otherStories = useMemo(() => stories.filter((story) => story.authorId !== profile.id), [stories, profile.id]);
  const orderedStories = useMemo(() => [...myStories, ...otherStories], [myStories, otherStories]);

  return (
    <div className="relative group">
      {/* Premium glassmorphism background */}
      <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      {/* Ambient glow effect */}
      <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 rounded-3xl blur-xl opacity-0 group-hover:opacity-50 transition-opacity duration-500" />

      {/* Scrollable container */}
      <div className="relative flex items-center gap-5 overflow-x-auto pb-4 px-2 scroll-smooth">
        {/* Add story button */}
        <AddStoryButton onCreateClick={onCreateClick} />

        {/* Stories */}
        {orderedStories.length === 0 ? (
          <div className="flex items-center justify-center gap-3 text-sm text-slate-500 dark:text-slate-400 px-8 py-4">
            <Sparkles className="w-4 h-4" />
            <span>No stories yet</span>
          </div>
        ) : (
          orderedStories.map((story: StoryResponse, index: number) => (
            <StoryAvatar
              key={story.id}
              story={story}
              isMine={story.authorId === profile.id}
              index={index}
              isViewed={story.isViewed ?? false}
              onStoryClick={onStoryClick}
            />
          ))
        )}
      </div>

      {/* Premium scroll shadow indicators */}
      <div className="pointer-events-none absolute top-0 left-0 h-full w-12 bg-gradient-to-r from-white/80 dark:from-slate-900/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-l-3xl" />
      <div className="pointer-events-none absolute top-0 right-0 h-full w-12 bg-gradient-to-l from-white/80 dark:from-slate-900/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-r-3xl" />
    </div>
  );
});
