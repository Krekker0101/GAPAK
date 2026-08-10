/**
 * GAPAK StoryViewerModal
 * Immersive Mobile-First Fullscreen Story Viewer.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Eye,
  Heart,
  Send,
  Volume2,
  VolumeX,
  Lock,
  Star,
  Globe,
  Users,
} from 'lucide-react';
import { UserStoryGroup, UserProfile, Story } from '../../shared/types';
import { Avatar, Badge } from '../../shared/design-system/primitives';
import { useToast } from '../../shared/ux/ToastContext';

interface StoryViewerModalProps {
  groups: UserStoryGroup[];
  initialGroupIndex: number;
  currentUser: UserProfile;
  onClose: () => void;
  onStoryReact?: (storyId: string, emoji: string) => void;
  onStoryView?: (storyId: string) => void;
  onStoryReply?: (storyId: string, text: string) => void;
}

export const StoryViewerModal: React.FC<StoryViewerModalProps> = ({
  groups,
  initialGroupIndex,
  currentUser,
  onClose,
  onStoryReact,
  onStoryView,
  onStoryReply,
}) => {
  const { addToast } = useToast();
  const [currentGroupIndex, setCurrentGroupIndex] = useState(initialGroupIndex);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [showViewersDrawer, setShowViewersDrawer] = useState(false);
  const [replyText, setReplyText] = useState('');

  const currentGroup = groups[currentGroupIndex] || groups[0];
  const stories = currentGroup?.stories || [];
  const currentStory: Story | undefined = stories[currentStoryIndex];

  useEffect(() => {
    if (currentStory && !currentStory.hasViewed) onStoryView?.(currentStory.id);
  }, [currentStory?.id, currentStory?.hasViewed, onStoryView]);

  // Preload next story image/video
  useEffect(() => {
    const nextStory = stories[currentStoryIndex + 1];
    if (nextStory && nextStory.mediaType === 'image') {
      const img = new Image();
      img.src = nextStory.mediaUrl;
    }
  }, [currentStoryIndex, stories]);

  const handleNextStory = useCallback(() => {
    if (currentStoryIndex < stories.length - 1) {
      setCurrentStoryIndex((prev) => prev + 1);
      setProgress(0);
    } else if (currentGroupIndex < groups.length - 1) {
      setCurrentGroupIndex((prev) => prev + 1);
      setCurrentStoryIndex(0);
      setProgress(0);
    } else {
      onClose();
    }
  }, [currentStoryIndex, stories.length, currentGroupIndex, groups.length, onClose]);

  const handlePrevStory = useCallback(() => {
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex((prev) => prev - 1);
      setProgress(0);
    } else if (currentGroupIndex > 0) {
      setCurrentGroupIndex((prev) => prev - 1);
      const prevGroup = groups[currentGroupIndex - 1];
      setCurrentStoryIndex(prevGroup.stories.length - 1);
      setProgress(0);
    }
  }, [currentStoryIndex, currentGroupIndex, groups]);

  // Story Auto-Advance Timer
  useEffect(() => {
    if (!currentStory || showViewersDrawer) return;

    const durationMs = (currentStory.durationSeconds || 5) * 1000;
    const intervalMs = 50;
    const step = (intervalMs / durationMs) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          return 100;
        }
        return prev + step;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [currentStory, showViewersDrawer]);

  // Advance story when progress reaches 100%
  useEffect(() => {
    if (progress >= 100) {
      handleNextStory();
    }
  }, [progress, handleNextStory]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') handleNextStory();
      if (e.key === 'ArrowLeft') handlePrevStory();
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNextStory, handlePrevStory, onClose]);

  if (!currentStory) return null;

  const isOwner = currentGroup.user.id === currentUser.id;

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    onStoryReply?.(currentStory.id, replyText.trim());
    addToast(`Reply sent to @${currentGroup.user.username}`, 'success');
    setReplyText('');
  };

  const handleReaction = (emoji: string) => {
    onStoryReact?.(currentStory.id, emoji);
    addToast(`Reacted with ${emoji}`, 'info');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center backdrop-blur-md">
      {/* Container Box */}
      <div className="relative w-full max-w-md h-full md:h-[90vh] md:max-h-[840px] md:rounded-[var(--radius-3xl)] overflow-hidden bg-surface flex flex-col justify-between shadow-token-lg border border-subtle">
        
        {/* Top Header: Progress Bars & Author Profile */}
        <div className="absolute top-0 inset-x-0 z-30 p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent space-y-3">
          {/* Progress Indicators */}
          <div className="flex space-x-1.5">
            {stories.map((s, idx) => (
              <div key={s.id} className="h-1 flex-1 bg-white/30 rounded-[var(--radius-pill)] overflow-hidden">
                <div
                  className="h-full bg-white transition-all duration-75"
                  style={{
                    width:
                      idx === currentStoryIndex
                        ? `${progress}%`
                        : idx < currentStoryIndex
                        ? '100%'
                        : '0%',
                  }}
                />
              </div>
            ))}
          </div>

          {/* User Info & Controls */}
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center space-x-2.5">
              <Avatar
                src={currentGroup.user.avatarUrl}
                alt={currentGroup.user.displayName}
                fallback={currentGroup.user.displayName[0]}
                size="sm"
              />
              <div>
                <span className="font-semibold text-xs">{currentGroup.user.displayName}</span>
                <span className="text-[10px] text-white/70 block">
                  {new Date(currentStory.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {currentStory.mediaType === 'video' && (
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className="p-1.5 rounded-[var(--radius-pill)] bg-black/40 hover:bg-black/60 transition"
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1.5 rounded-[var(--radius-pill)] bg-black/40 hover:bg-black/60 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Media Surface */}
        <div className="relative w-full h-full flex items-center justify-center bg-black">
          {currentStory.mediaType === 'video' ? (
            <video
              src={currentStory.mediaUrl}
              autoPlay
              muted={isMuted}
              loop
              className="w-full h-full object-cover"
            />
          ) : (
            <img
              src={currentStory.mediaUrl}
              alt="Story"
              className="w-full h-full object-cover"
            />
          )}

          {/* Left / Right Tap Zones */}
          <div
            onClick={handlePrevStory}
            className="absolute left-0 top-0 w-1/3 h-full z-10 cursor-pointer"
          />
          <div
            onClick={handleNextStory}
            className="absolute right-0 top-0 w-1/3 h-full z-10 cursor-pointer"
          />
        </div>

        {/* Bottom Bar: Reactions & Reply / Viewer Drawer */}
        <div className="absolute bottom-0 inset-x-0 z-30 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent space-y-3">
          {/* Reaction Bar */}
          <div className="flex items-center justify-center space-x-3">
            {['🔥', '❤️', '👏', '🚀', '✨'].map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleReaction(emoji)}
                className="text-2xl hover:scale-125 transition transform"
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Send Reply or Viewers trigger for owner */}
          {isOwner ? (
            <button
              onClick={() => setShowViewersDrawer(true)}
              className="w-full py-2.5 rounded-[var(--radius-xl)] bg-white/10 hover:bg-white/20 backdrop-blur-md text-white text-xs font-semibold flex items-center justify-center space-x-2 transition"
            >
              <Eye className="w-4 h-4" />
              <span>{currentStory.viewsCount} Viewers</span>
            </button>
          ) : (
            <form onSubmit={handleSendReply} className="flex items-center space-x-2">
              <input
                type="text"
                placeholder={`Send reply to ${currentGroup.user.displayName}...`}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-[var(--radius-2xl)] bg-white/10 backdrop-blur-md border border-white/20 text-white placeholder-white/60 text-xs focus:outline-none focus:ring-1 focus:ring-white"
              />
              <button
                type="submit"
                disabled={!replyText.trim()}
                className="p-2.5 rounded-[var(--radius-2xl)] bg-indigo-600 text-white disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>

        {/* Viewers Drawer Modal for Story Owner */}
        <AnimatePresence>
          {showViewersDrawer && (
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="absolute inset-x-0 bottom-0 z-40 bg-surface border-t border-subtle rounded-t-3xl p-5 space-y-4 max-h-[60%] overflow-y-auto"
            >
              <div className="flex items-center justify-between text-white border-b border-subtle pb-3">
                <h4 className="font-bold text-sm flex items-center space-x-2">
                  <Eye className="w-4 h-4 text-indigo-400" />
                  <span>Story Viewers ({currentStory.viewsCount})</span>
                </h4>
                <button
                  onClick={() => setShowViewersDrawer(false)}
                  className="p-1 rounded-[var(--radius-pill)] text-tertiary hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                {currentStory.viewers && currentStory.viewers.length > 0 ? (
                  currentStory.viewers.map((viewer) => (
                    <div key={viewer.id} className="flex items-center justify-between text-white">
                      <div className="flex items-center space-x-3">
                        <Avatar src={viewer.avatarUrl} alt={viewer.displayName} fallback={viewer.displayName[0]} size="sm" />
                        <div>
                          <span className="font-semibold text-xs block">{viewer.displayName}</span>
                          <span className="text-[10px] text-tertiary">@{viewer.username}</span>
                        </div>
                      </div>
                      <Badge variant="success" className="text-[10px]">Viewed</Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-tertiary text-center py-4">
                    Your story was published recently. Viewer analytics updated in real-time.
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
