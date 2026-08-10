/**
 * GAPAK Post Subcomponent: PostCommentsPreview
 * Threaded & nested comments rendering with inline response.
 */

import React, { useState } from 'react';
import { Heart, Send, CornerDownRight } from 'lucide-react';
import { Comment, UserProfile } from '../../shared/types';
import { Avatar, Button, Input } from '../../shared/design-system/primitives';
import { MentionText } from '../../shared/text/MentionText';

interface PostCommentsPreviewProps {
  comments: Comment[];
  currentUser: UserProfile;
  onAddComment: (body: string, parentId?: string) => void;
}

export const PostCommentsPreview: React.FC<PostCommentsPreviewProps> = ({
  comments,
  currentUser,
  onAddComment,
}) => {
  const [commentText, setCommentText] = useState('');
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const handleSubmitMain = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    onAddComment(commentText);
    setCommentText('');
  };

  const handleSubmitReply = (parentId: string) => {
    if (!replyText.trim()) return;
    onAddComment(replyText, parentId);
    setReplyText('');
    setReplyingToId(null);
  };

  const renderComment = (comment: Comment, isNested = false) => {
    return (
      <div key={comment.id} className={`space-y-2 ${isNested ? 'ml-8 mt-2 border-l-2 border-subtle dark:border-subtle pl-3' : ''}`}>
        <div className="flex items-start space-x-2.5 group">
          <Avatar
            src={comment.author.avatarUrl}
            alt={comment.author.displayName}
            fallback={comment.author.displayName[0]}
            size="sm"
          />
          <div className="flex-1 min-w-0">
            <div className="p-3 rounded-[var(--radius-2xl)] bg-surface-subtle dark:bg-surface-glass text-xs">
              <div className="flex items-center justify-between font-semibold text-primary dark:text-primary mb-0.5">
                <span>{comment.author.displayName}</span>
                <span className="text-[10px] text-tertiary font-normal">
                  {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-secondary dark:text-secondary"><MentionText text={comment.body} /></p>
            </div>

            <div className="flex items-center space-x-3 mt-1 ml-2 text-[11px] text-muted">
              <button className="hover:text-rose-500 font-medium">Like ({comment.likesCount})</button>
              <button
                onClick={() => setReplyingToId(replyingToId === comment.id ? null : comment.id)}
                className="hover:text-indigo-500 font-medium flex items-center space-x-1"
              >
                <CornerDownRight className="w-3 h-3" />
                <span>Reply</span>
              </button>
            </div>

            {/* Inline reply input */}
            {replyingToId === comment.id && (
              <div className="mt-2 flex items-center space-x-2">
                <input
                  type="text"
                  placeholder={`Reply to ${comment.author.displayName}...`}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-[var(--radius-xl)] border border-subtle dark:border-default bg-surface dark:bg-surface text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  onClick={() => handleSubmitReply(comment.id)}
                  className="p-1.5 rounded-[var(--radius-lg)] bg-indigo-600 text-white text-xs hover:bg-indigo-700 transition"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Nested Replies */}
        {comment.replies && comment.replies.map((reply) => renderComment(reply, true))}
      </div>
    );
  };

  return (
    <div className="px-4 py-3 bg-surface-glass dark:bg-surface-glass border-t border-subtle dark:border-subtle space-y-3">
      {/* Existing Comments list */}
      <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
        {comments.map((comment) => renderComment(comment))}
      </div>

      {/* Main Comment Input */}
      <form onSubmit={handleSubmitMain} className="flex items-center space-x-2 pt-2">
        <Avatar
          src={currentUser.avatarUrl}
          alt={currentUser.displayName}
          fallback={currentUser.displayName[0]}
          size="sm"
        />
        <input
          type="text"
          placeholder="Write a comment..."
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          className="flex-1 px-3.5 py-2 rounded-[var(--radius-xl)] border border-subtle dark:border-subtle bg-surface dark:bg-surface text-xs text-primary dark:text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="submit"
          disabled={!commentText.trim()}
          className="p-2 rounded-[var(--radius-xl)] bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
