import React, { useState } from 'react';
import { MessageSquare, Heart, Share2, Trash2 } from 'lucide-react';
import type { Post } from '../../shared/api/backendContracts';
import { postsApi } from './api/postsApi';
import { useToast } from '../../shared/ux/ToastContext';

interface Props {
  post: Post;
  currentUserId: string;
  onLikeToggle: (postId: string) => void;
  onAddComment: (postId: string, content: string, parentCommentId?: string) => void;
  onUserClick?: (userId: string) => void;
  onDeletePost?: (postId: string) => void;
}

export const BackendPostCard: React.FC<Props> = ({ post, currentUserId, onLikeToggle, onAddComment, onUserClick, onDeletePost }) => {
  const { addToast } = useToast();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<Awaited<ReturnType<typeof postsApi.comments>>>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);

  const openComments = async () => {
    const next = !commentsOpen;
    setCommentsOpen(next);
    if (!next || comments.length > 0) return;
    setCommentsLoading(true);
    try {
      setComments(await postsApi.comments(post.id, { limit: 20 }));
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Unable to load comments', 'error');
    } finally {
      setCommentsLoading(false);
    }
  };

  const submitComment = () => {
    const content = commentText.trim();
    if (!content) return;
    onAddComment(post.id, content);
    setCommentText('');
  };

  return (
    <article className="rounded-[var(--radius-2xl)] border border-subtle bg-surface shadow-token-sm overflow-hidden">
      <header className="p-4 pb-2">
        <button className="text-left" onClick={() => onUserClick?.(post.authorId)}>
          <div className="font-semibold text-primary">{post.authorId === currentUserId ? 'You' : post.authorId}</div>
          <div className="text-xs text-tertiary">{new Date(post.publishedAt).toLocaleString()}</div>
        </button>
        <div className="mt-2 text-xs text-tertiary">{post.privacy} · {post.contentType}</div>
      </header>

      <div className="px-4 py-2 text-sm text-primary whitespace-pre-line">{post.body}</div>

      {post.mediaFileIDs?.length ? (
        <div className="px-4 pb-3 text-xs text-tertiary" aria-label="Attached media">
          {post.mediaFileIDs.length} media attachment{post.mediaFileIDs.length === 1 ? '' : 's'}
        </div>
      ) : null}

      <div className="flex items-center gap-5 px-4 py-3 border-t border-subtle text-sm text-muted">
        <button onClick={() => onLikeToggle(post.id)} className={post.isLiked ? 'text-rose-500' : ''} aria-label={post.isLiked ? 'Unlike post' : 'Like post'}>
          <Heart className={`w-5 h-5 inline mr-1 ${post.isLiked ? 'fill-current' : ''}`} />{post.likeCount}
        </button>
        <button onClick={() => void openComments()} aria-label="Show comments">
          <MessageSquare className="w-5 h-5 inline mr-1" />{post.commentCount}
        </button>
        <button onClick={() => { void navigator.clipboard?.writeText(`${window.location.origin}/posts/${post.id}`); addToast('Post link copied', 'info'); }} aria-label="Share post">
          <Share2 className="w-5 h-5 inline" />
        </button>
        {post.authorId === currentUserId && onDeletePost ? (
          <button onClick={() => onDeletePost(post.id)} aria-label="Delete post" className="ml-auto text-rose-500"><Trash2 className="w-5 h-5" /></button>
        ) : null}
      </div>

      {commentsOpen && (
        <section className="border-t border-subtle p-4 space-y-3">
          {commentsLoading ? <div className="text-xs text-tertiary">Loading comments…</div> : null}
          {comments.map((comment) => (
            <div key={comment.id} className="text-sm">
              <button className="font-semibold text-primary" onClick={() => onUserClick?.(comment.authorId)}>{comment.authorId}</button>
              <div className="text-secondary">{comment.content}</div>
            </div>
          ))}
          <div className="flex gap-2">
            <input value={commentText} onChange={(e) => setCommentText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submitComment(); }} className="flex-1 rounded-xl border border-subtle bg-surface px-3 py-2 text-sm" placeholder="Write a comment…" />
            <button onClick={submitComment} disabled={!commentText.trim()} className="rounded-xl bg-indigo-600 px-3 py-2 text-white disabled:opacity-40">Send</button>
          </div>
        </section>
      )}
    </article>
  );
};
