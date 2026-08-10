/**
 * GAPAK Post Subcomponent: PostHeader
 */

import React from 'react';
import { Shield, Eye, Lock, Clock, Sparkles, MoreHorizontal, Globe, Users, Star } from 'lucide-react';
import { UserProfile, ContentPrivacyLevel } from '../../shared/types';
import { Avatar, Badge } from '../../shared/design-system/primitives';

interface PostHeaderProps {
  author: UserProfile;
  createdAt: string;
  privacy: ContentPrivacyLevel;
  isInTrustedCircle?: boolean;
  expiresAt?: string;
  onUserClick?: (userId: string) => void;
  onMenuClick?: () => void;
}

export const PostHeader: React.FC<PostHeaderProps> = ({
  author,
  createdAt,
  privacy,
  isInTrustedCircle,
  expiresAt,
  onUserClick,
  onMenuClick,
}) => {
  const formatTimeAgo = (dateStr: string) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const renderPrivacyBadge = () => {
    switch (privacy) {
      case 'TRUSTED_CIRCLE':
        return (
          <Badge variant="accent" className="flex items-center space-x-1 text-[11px] py-0.5 px-2 bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <Star className="w-3 h-3 fill-amber-500" />
            <span>Trusted Circle</span>
          </Badge>
        );
      case 'ONE_TIME':
        return (
          <Badge variant="warning" className="flex items-center space-x-1 text-[11px] py-0.5 px-2 bg-rose-500/10 text-rose-500 border border-rose-500/20">
            <Eye className="w-3 h-3" />
            <span>One-Time View</span>
          </Badge>
        );
      case 'TIMED':
        return (
          <Badge variant="info" className="flex items-center space-x-1 text-[11px] py-0.5 px-2 bg-sky-500/10 text-sky-500 border border-sky-500/20">
            <Clock className="w-3 h-3" />
            <span>Timed Expiring</span>
          </Badge>
        );
      case 'FRIENDS':
        return (
          <Badge variant="neutral" className="flex items-center space-x-1 text-[11px] py-0.5 px-2">
            <Users className="w-3 h-3" />
            <span>Connections</span>
          </Badge>
        );
      case 'PRIVATE':
        return (
          <Badge variant="neutral" className="flex items-center space-x-1 text-[11px] py-0.5 px-2">
            <Lock className="w-3 h-3" />
            <span>Only Me</span>
          </Badge>
        );
      case 'PUBLIC':
      default:
        return (
          <span className="text-tertiary dark:text-muted flex items-center space-x-1 text-xs">
            <Globe className="w-3 h-3" />
          </span>
        );
    }
  };

  return (
    <div className="flex items-start justify-between p-4 pb-2">
      <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onUserClick?.(author.id)}>
        <Avatar src={author.avatarUrl} alt={author.displayName} fallback={author.displayName[0]} presence={author.presence} size="md" />
        <div>
          <div className="flex items-center space-x-1.5 flex-wrap">
            <span className="font-semibold text-primary dark:text-primary hover:underline">
              {author.displayName}
            </span>
            <span className="text-xs text-muted dark:text-tertiary">@{author.username}</span>
            {author.role === 'admin' && (
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                CORE
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2 mt-0.5 text-xs text-muted dark:text-tertiary">
            <span>{formatTimeAgo(createdAt)}</span>
            <span>•</span>
            {renderPrivacyBadge()}
          </div>
        </div>
      </div>

      <button
        onClick={onMenuClick}
        className="p-1.5 rounded-[var(--radius-lg)] text-tertiary hover:text-secondary dark:hover:text-primary hover:bg-surface-subtle dark:hover:bg-surface-muted transition"
      >
        <MoreHorizontal className="w-5 h-5" />
      </button>
    </div>
  );
};
