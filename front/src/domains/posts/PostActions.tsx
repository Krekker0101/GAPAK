/**
 * GAPAK Post Subcomponent: PostActions
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Heart, MessageSquare, Share2, Bookmark, Eye } from 'lucide-react';
import { useToast } from '../../shared/ux/ToastContext';

interface PostActionsProps {
  postId: string;
  likesCount: number;
  likedByMe: boolean;
  commentsCount: number;
  bookmarkedByMe?: boolean;
  onLikeToggle: () => void;
  onCommentToggle: () => void;
  onShareClick?: () => void;
  onBookmarkToggle?: () => void;
}

export const PostActions: React.FC<PostActionsProps> = ({
  postId,
  likesCount,
  likedByMe,
  commentsCount,
  bookmarkedByMe = false,
  onLikeToggle,
  onCommentToggle,
  onShareClick,
  onBookmarkToggle,
}) => {
  const { addToast } = useToast();
  const [isBookmarked, setIsBookmarked] = useState(bookmarkedByMe);

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(`${window.location.origin}/post/${postId}`);
      addToast('Post link copied to clipboard!', 'info');
    }
    if (onShareClick) onShareClick();
  };

  const handleBookmark = () => {
    setIsBookmarked(!isBookmarked);
    addToast(isBookmarked ? 'Removed from saved items' : 'Saved to your bookmarks', 'info');
    if (onBookmarkToggle) onBookmarkToggle();
  };

  return (
    <div className="flex items-center justify-between px-4 py-2 border-t border-subtle dark:border-subtle text-muted dark:text-tertiary">
      <div className="flex items-center space-x-6">
        {/* Like Button */}
        <button
          onClick={onLikeToggle}
          className={`flex items-center space-x-1.5 text-xs font-semibold transition group ${
            likedByMe ? 'text-rose-500' : 'hover:text-rose-500'
          }`}
        >
          <motion.div whileTap={{ scale: 1.3 }}>
            <Heart className={`w-5 h-5 ${likedByMe ? 'fill-rose-500 text-rose-500' : ''}`} />
          </motion.div>
          <span>{likesCount}</span>
        </button>

        {/* Comment Button */}
        <button
          onClick={onCommentToggle}
          className="flex items-center space-x-1.5 text-xs font-semibold hover:text-indigo-500 transition"
        >
          <MessageSquare className="w-5 h-5" />
          <span>{commentsCount}</span>
        </button>

        {/* Share Button */}
        <button
          onClick={handleShare}
          className="flex items-center space-x-1.5 text-xs font-semibold hover:text-emerald-500 transition"
        >
          <Share2 className="w-5 h-5" />
        </button>
      </div>

      {/* Bookmark */}
      <button
        onClick={handleBookmark}
        className={`p-1.5 rounded-[var(--radius-lg)] transition ${
          isBookmarked ? 'text-indigo-600 dark:text-indigo-400' : 'hover:text-indigo-500'
        }`}
      >
        <Bookmark className={`w-5 h-5 ${isBookmarked ? 'fill-indigo-600 dark:fill-indigo-400' : ''}`} />
      </button>
    </div>
  );
};
