/**
 * GAPAK Post Card - Composable Container
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Post, UserProfile } from '../../shared/types';
import { PostHeader } from './PostHeader';
import { PostMedia } from './PostMedia';
import { PostBody } from './PostBody';
import { PostActions } from './PostActions';
import { PostAudience } from './PostAudience';
import { PostCommentsPreview } from './PostCommentsPreview';
import { PostMenu } from './PostMenu';
import { PostFooter } from './PostFooter';

interface PostCardProps {
  post: Post;
  currentUser: UserProfile;
  onLikeToggle: (postId: string) => void;
  onAddComment: (postId: string, body: string, parentId?: string) => void;
  onUserClick?: (userId: string) => void;
  onRevealOneTime?: (postId: string) => void;
  onDeletePost?: (postId: string) => void;
}

export const PostCard: React.FC<PostCardProps> = ({
  post,
  currentUser,
  onLikeToggle,
  onAddComment,
  onUserClick,
  onRevealOneTime,
  onDeletePost,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showComments, setShowComments] = useState(false);

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="relative rounded-[var(--radius-2xl)] border border-subtle dark:border-subtle bg-surface dark:bg-surface shadow-token-sm hover:shadow-token-md transition-all duration-200 overflow-hidden"
    >
      {/* Context Menu Dropdown */}
      {showMenu && (
        <PostMenu
          postId={post.id}
          isOwner={post.author.id === currentUser.id}
          onClose={() => setShowMenu(false)}
          onDelete={() => onDeletePost?.(post.id)}
        />
      )}

      {/* Header */}
      <PostHeader
        author={post.author}
        createdAt={post.createdAt}
        privacy={post.privacy}
        isInTrustedCircle={post.isInTrustedCircle}
        expiresAt={post.expiresAt}
        onUserClick={onUserClick}
        onMenuClick={() => setShowMenu(!showMenu)}
      />

      {/* Body */}
      <PostBody body={post.body} audienceTags={post.audienceTags} />

      {/* Audience Security Policy Banner */}
      <PostAudience
        privacy={post.privacy}
        isInTrustedCircle={post.isInTrustedCircle}
        expiresAt={post.expiresAt}
      />

      {/* Media Carousel / Video / One-Time */}
      <PostMedia
        media={post.media}
        privacy={post.privacy}
        oneTimeViewed={post.oneTimeViewed}
        onRevealOneTime={() => onRevealOneTime?.(post.id)}
      />

      {/* Actions */}
      <PostActions
        postId={post.id}
        likesCount={post.likesCount}
        likedByMe={post.likedByMe}
        commentsCount={post.commentsCount}
        onLikeToggle={() => onLikeToggle(post.id)}
        onCommentToggle={() => setShowComments(!showComments)}
      />

      {/* Footer Meta */}
      <PostFooter createdAt={post.createdAt} sharesCount={post.sharesCount} />

      {/* Comments Drawer */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <PostCommentsPreview
              comments={post.comments}
              currentUser={currentUser}
              onAddComment={(text, parentId) => onAddComment(post.id, text, parentId)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
};
