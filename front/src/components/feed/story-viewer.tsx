"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Heart, Zap, ThumbsUp, Volume2, VolumeX, Eye, Send, MoreHorizontal, Pause, Play } from "lucide-react";
import { storyService } from "@/shared/api/services/story.service";
import { useMediaUrl } from "@/shared/lib/hooks/use-media-url";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import { StoryViewersModal } from "@/components/feed/story-viewers-modal";
import type { StoryResponse, StoryReactionType } from "@/shared/types/story";
import { formatRelativeTime } from "@/shared/lib/utils";

interface StoryViewerProps {
  storyId: string;
  stories: StoryResponse[];
  currentIndex: number;
  onClose: () => void;
  onNavigate?: (index: number) => void;
}

const REACTION_EMOJIS: Record<StoryReactionType, { icon: React.ReactNode; label: string; color: string }> = {
  LIKE: { icon: <Heart className="h-5 w-5 fill-red-500 text-red-500" />, label: "Like", color: "text-red-500" },
  FIRE: { icon: <Zap className="h-5 w-5 text-orange-500" />, label: "Fire", color: "text-orange-500" },
  SUPPORT: { icon: <ThumbsUp className="h-5 w-5 text-blue-500" />, label: "Support", color: "text-blue-500" },
};

export function StoryViewer({ storyId, stories, currentIndex, onClose, onNavigate }: StoryViewerProps) {
  const [currentStoryIndex, setCurrentStoryIndex] = useState(currentIndex);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [duration, setDuration] = useState(5000);
  const [viewerCount, setViewerCount] = useState(0);
  const [userReaction, setUserReaction] = useState<StoryReactionType | null>(null);
  const [showViewersModal, setShowViewersModal] = useState(false);
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyText] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const progressRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const startTimeRef = useRef<number>(Date.now());

  const currentStory = stories[currentStoryIndex];
  const { url: mediaUrl } = useMediaUrl(currentStory.mediaFileId, "story-preview");
  const { url: authorUrl } = useMediaUrl(currentStory.authorId, "profile-avatar");

  const isVideo = currentStory.videoAssetId != null;

  useEffect(() => {
    if (isVideo && videoRef.current) {
      videoRef.current.onloadedmetadata = () => {
        const videoDuration = (videoRef.current?.duration ?? 5) * 1000;
        setDuration(Math.max(videoDuration, 3000));
      };
    } else {
      setDuration(5000 + Math.random() * 2000);
    }
  }, [isVideo]);

  useEffect(() => {
    const loadViewers = async () => {
      try {
        const viewers = await storyService.viewers(currentStory.id);
        setViewerCount(viewers.length);
      } catch (err) {
        console.error("Failed to load viewers:", err);
      }
    };
    loadViewers();
  }, [currentStory.id]);

  useEffect(() => {
    if (!isPaused && !isVideo) {
      startTimeRef.current = Date.now();
      progressRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        const newProgress = Math.min((elapsed / duration) * 100, 100);
        setProgress(newProgress);

        if (newProgress >= 100) {
          handleNext();
        }
      }, 30);

      return () => {
        if (progressRef.current) clearInterval(progressRef.current);
      };
    }

    if (isVideo && videoRef.current) {
      videoRef.current.onended = () => handleNext();
      if (!isPaused) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPaused, duration, isVideo]);

  const handleNext = useCallback(() => {
    if (currentStoryIndex < stories.length - 1) {
      const nextIndex = currentStoryIndex + 1;
      setCurrentStoryIndex(nextIndex);
      setProgress(0);
      onNavigate?.(nextIndex);
    } else {
      onClose();
    }
  }, [currentStoryIndex, stories.length, onNavigate, onClose]);

  const handlePrevious = useCallback(() => {
    if (currentStoryIndex > 0) {
      const prevIndex = currentStoryIndex - 1;
      setCurrentStoryIndex(prevIndex);
      setProgress(0);
      onNavigate?.(prevIndex);
    }
  }, [currentStoryIndex, onNavigate]);

  const handleReact = async (reactionType: StoryReactionType) => {
    try {
      await storyService.react(currentStory.id, { reactionType });
      setUserReaction(reactionType);
    } catch (err) {
      console.error("Failed to react:", err);
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim()) return;
    try {
      // API call to send reply
      console.log("Send reply:", replyText);
      setReplyText("");
      setShowReplyInput(false);
    } catch (err) {
      console.error("Failed to send reply:", err);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "ArrowLeft") handlePrevious();
      if (e.key === " ") {
        e.preventDefault();
        setIsPaused((prev) => !prev);
      }
      if (e.key === "m" || e.key === "M") {
        setIsMuted((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNext, handlePrevious, onClose, isMuted]);

  const touchStartRef = useRef<number>(0);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStartRef.current - touchEnd;
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        handleNext();
      } else {
        handlePrevious();
      }
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black flex items-center justify-center"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Background blur */}
        <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" />

        {/* Close button */}
        <motion.button
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onClick={onClose}
          className="absolute top-4 right-4 z-10 text-white hover:bg-white/10 p-2 rounded-full transition-all duration-300"
          aria-label="Close"
        >
          <X className="h-6 w-6" />
        </motion.button>

        {/* Progress bars */}
        <div className="absolute top-0 left-0 right-0 flex gap-1 p-4 z-10">
          {stories.map((_, idx) => (
            <div key={idx} className="flex-1 h-0.5 bg-white/20 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-white"
                initial={{ width: idx < currentStoryIndex ? "100%" : "0%" }}
                animate={{ width: idx === currentStoryIndex ? `${progress}%` : idx < currentStoryIndex ? "100%" : "0%" }}
                transition={{ duration: 0.1 }}
              />
            </div>
          ))}
        </div>

        {/* Story header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="absolute top-16 left-0 right-0 z-10 px-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Avatar className="h-12 w-12 border-2 border-white/30">
                  {authorUrl && <AvatarImage src={authorUrl} alt="Author" />}
                  <AvatarFallback className="text-sm bg-gradient-to-br from-blue-500 to-purple-500 text-white">
                    {currentStory.authorId.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-black" />
              </div>
              <div className="text-white">
                <p className="font-semibold text-base">{currentStory.authorId}</p>
                <p className="text-xs text-white/70">{formatRelativeTime(currentStory.publishedAt)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowViewersModal(true)}
                className="flex items-center gap-1.5 text-white/70 hover:text-white transition-colors text-sm cursor-pointer bg-white/10 px-3 py-1.5 rounded-full"
              >
                <Eye className="h-4 w-4" />
                <span className="font-medium">{viewerCount}</span>
              </button>
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Media container */}
        <div className="relative w-full h-full max-w-md max-h-[85vh] flex items-center justify-center bg-black rounded-3xl overflow-hidden mx-4">
          {!isVideo && mediaUrl && (
            <img
              src={mediaUrl}
              alt="Story"
              className="w-full h-full object-cover"
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
            />
          )}

          {isVideo && mediaUrl && (
            <video
              ref={videoRef}
              src={mediaUrl}
              className="w-full h-full object-cover"
              muted={isMuted}
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
            />
          )}

          {/* Caption overlay */}
          {currentStory.caption && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-6">
              <p className="text-white text-base leading-relaxed">{currentStory.caption}</p>
            </div>
          )}

          {/* Pause overlay */}
          <AnimatePresence>
            {isPaused && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-sm"
              >
                <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Pause className="h-10 w-10 text-white" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation buttons */}
        <AnimatePresence>
          {currentStoryIndex > 0 && (
            <motion.button
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onClick={handlePrevious}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/10 p-3 rounded-full transition-all duration-300"
              aria-label="Previous"
            >
              <ChevronLeft className="h-8 w-8" />
            </motion.button>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {currentStoryIndex < stories.length - 1 && (
            <motion.button
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              onClick={handleNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/10 p-3 rounded-full transition-all duration-300"
              aria-label="Next"
            >
              <ChevronRight className="h-8 w-8" />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Reactions and controls */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="absolute bottom-4 left-0 right-0 z-10 px-4 flex items-center justify-between max-w-md mx-auto"
        >
          <div className="flex gap-3">
            {Object.entries(REACTION_EMOJIS).map(([reactionType, { icon, label }]) => (
              <motion.button
                key={reactionType}
                whileTap={{ scale: 0.9 }}
                onClick={() => handleReact(reactionType as StoryReactionType)}
                className={`transition-all ${
                  userReaction === reactionType
                    ? "scale-110 opacity-100"
                    : "opacity-70 hover:opacity-100"
                }`}
                title={label}
                aria-label={label}
              >
                <div className="text-3xl">{icon}</div>
              </motion.button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10"
              onClick={() => setShowReplyInput(!showReplyInput)}
            >
              <Send className="h-5 w-5" />
            </Button>
            {isVideo && (
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10"
                onClick={() => setIsMuted(!isMuted)}
                aria-label={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </Button>
            )}
          </div>
        </motion.div>

        {/* Reply input */}
        <AnimatePresence>
          {showReplyInput && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute bottom-20 left-4 right-4 z-20 max-w-md mx-auto"
            >
              <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-2 flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Reply to story..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="flex-1 bg-transparent text-white placeholder-white/50 px-4 py-2 outline-none"
                  autoFocus
                />
                <Button
                  size="icon"
                  onClick={handleSendReply}
                  disabled={!replyText.trim()}
                  className="bg-white text-black hover:bg-white/90"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {showViewersModal && (
        <StoryViewersModal
          storyId={currentStory.id}
          onClose={() => setShowViewersModal(false)}
        />
      )}
    </AnimatePresence>
  );
}
