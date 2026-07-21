"use client";

import { useState, useEffect } from "react";
import { X, Heart, Zap, ThumbsUp } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { storyService } from "@/shared/api/services/story.service";
import type { StoryViewerResponse, StoryReactionType } from "@/shared/types/story";

interface StoryViewersModalProps {
  storyId: string;
  onClose: () => void;
}

const REACTION_EMOJIS: Record<StoryReactionType, { icon: React.ReactNode; label: string; color: string }> = {
  LIKE: { icon: <Heart className="h-4 w-4 fill-red-500 text-red-500" />, label: "Like", color: "text-red-500" },
  FIRE: { icon: <Zap className="h-4 w-4 text-orange-500" />, label: "Fire", color: "text-orange-500" },
  SUPPORT: { icon: <ThumbsUp className="h-4 w-4 text-blue-500" />, label: "Support", color: "text-blue-500" },
};

export function StoryViewersModal({ storyId, onClose }: StoryViewersModalProps) {
  const [viewers, setViewers] = useState<StoryViewerResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadViewers = async () => {
      try {
        const data = await storyService.viewers(storyId);
        setViewers(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load viewers");
      } finally {
        setIsLoading(false);
      }
    };

    loadViewers();
  }, [storyId]);

  const viewersWithoutReaction = viewers.filter((v) => !v.reactionType);
  const viewersWithReaction = viewers.filter((v) => v.reactionType);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col bg-background">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-semibold">
            Viewers ({viewers.length})
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              Loading viewers...
            </div>
          ) : error ? (
            <div className="p-4 text-center text-sm text-destructive">
              {error}
            </div>
          ) : viewers.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              No viewers yet
            </div>
          ) : (
            <div className="space-y-1">
              {/* Viewers with reactions */}
              {viewersWithReaction.length > 0 && (
                <>
                  {viewersWithReaction.map((viewer) => (
                    <div
                      key={viewer.viewerUserId}
                      className="flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-b-0"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {viewer.viewerUserId.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium truncate">
                          {viewer.viewerUserId}
                        </span>
                      </div>
                      {viewer.reactionType && (
                        <div className="flex items-center gap-1">
                          {REACTION_EMOJIS[viewer.reactionType].icon}
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}

              {/* Viewers without reactions */}
              {viewersWithoutReaction.length > 0 && (
                <>
                  {viewersWithReaction.length > 0 && (
                    <div className="px-4 py-2 text-xs font-medium text-muted-foreground">
                      Also viewed
                    </div>
                  )}
                  {viewersWithoutReaction.map((viewer) => (
                    <div
                      key={viewer.viewerUserId}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-b-0"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {viewer.viewerUserId.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium truncate">
                        {viewer.viewerUserId}
                      </span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10">
          <Button onClick={onClose} variant="outline" className="w-full">
            Close
          </Button>
        </div>
      </Card>
    </div>
  );
}
