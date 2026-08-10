/**
 * GAPAK Post Subcomponent: PostMenu
 */

import React from 'react';
import { Bookmark, Flag, EyeOff, UserX, Link as LinkIcon, Trash2, ShieldAlert } from 'lucide-react';
import { useToast } from '../../shared/ux/ToastContext';

interface PostMenuProps {
  postId: string;
  isOwner?: boolean;
  onClose: () => void;
  onDelete?: () => void;
}

export const PostMenu: React.FC<PostMenuProps> = ({ postId, isOwner, onClose, onDelete }) => {
  const { addToast } = useToast();

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/post/${postId}`);
    addToast('Post URL copied to clipboard', 'info');
    onClose();
  };

  const handleUnavailableAction = (action: string) => {
    addToast(`${action} is unavailable until the backend contract is implemented.`, 'warn');
    onClose();
  };

  return (
    <div className="absolute right-4 top-12 w-52 rounded-[var(--radius-2xl)] bg-surface dark:bg-surface border border-subtle dark:border-subtle shadow-token-lg z-30 p-1.5 space-y-1 text-xs">
      <button
        onClick={handleCopyLink}
        className="w-full flex items-center space-x-2 px-3 py-2 rounded-[var(--radius-xl)] text-secondary dark:text-primary hover:bg-surface-subtle dark:hover:bg-surface-muted transition"
      >
        <LinkIcon className="w-4 h-4 text-tertiary" />
        <span>Copy Post Link</span>
      </button>

      <button
        onClick={() => handleUnavailableAction('Hide post')}
        className="w-full flex items-center space-x-2 px-3 py-2 rounded-[var(--radius-xl)] text-secondary dark:text-primary hover:bg-surface-subtle dark:hover:bg-surface-muted transition"
      >
        <EyeOff className="w-4 h-4 text-tertiary" />
        <span>Hide Post</span>
      </button>

      <button
        onClick={() => handleUnavailableAction('Mute author')}
        className="w-full flex items-center space-x-2 px-3 py-2 rounded-[var(--radius-xl)] text-secondary dark:text-primary hover:bg-surface-subtle dark:hover:bg-surface-muted transition"
      >
        <UserX className="w-4 h-4 text-tertiary" />
        <span>Mute Author</span>
      </button>

      <button
        onClick={() => handleUnavailableAction('Report post')}
        className="w-full flex items-center space-x-2 px-3 py-2 rounded-[var(--radius-xl)] text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
      >
        <Flag className="w-4 h-4 text-rose-500" />
        <span>Report Post</span>
      </button>

      {isOwner && onDelete && (
        <button
          onClick={() => {
            onDelete?.();
            onClose();
          }}
          className="w-full flex items-center space-x-2 px-3 py-2 rounded-[var(--radius-xl)] text-rose-600 font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/30 transition border-t border-subtle dark:border-subtle pt-2"
        >
          <Trash2 className="w-4 h-4 text-rose-600" />
          <span>Delete Post</span>
        </button>
      )}
    </div>
  );
};
