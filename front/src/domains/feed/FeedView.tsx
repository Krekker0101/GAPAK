/**
 * GAPAK Premium Social Experience Feed
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Globe,
  Users,
  Star,
  Film,
  Eye,
  Filter,
  Sparkles,
  Search,
  Plus,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react';
import { UserStoryGroup, UserProfile } from '../../shared/types';
import type { Post as BackendPost } from '../../shared/api/backendContracts';
import type { CreatePostRequest } from '../posts/api/postsApi';
import { StoryBar } from '../stories/StoryBar';
import { StoryViewerModal } from '../stories/StoryViewerModal';
import { PostComposer } from '../posts/PostComposer';
import { BackendPostCard } from '../posts/BackendPostCard';
import { Button, Input, Badge } from '../../shared/design-system/primitives';
import { useToast } from '../../shared/ux/ToastContext';

type FeedFilter = 'all' | 'following' | 'trusted' | 'clips' | 'one_time';

interface FeedViewProps {
  currentUser: UserProfile;
  posts: BackendPost[];
  storyGroups: UserStoryGroup[];
  onLikeToggle: (postId: string) => void;
  onAddComment: (postId: string, text: string, parentId?: string) => void;
  onCreatePost: (post: CreatePostRequest) => Promise<unknown>;
  onCreateStory: () => void;
  onUserClick?: (userId: string) => void;
  onStoryReact?: (storyId: string, emoji: string) => void;
  onDeletePost?: (postId: string) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const FeedView: React.FC<FeedViewProps> = ({
  currentUser,
  posts,
  storyGroups,
  onLikeToggle,
  onAddComment,
  onCreatePost,
  onCreateStory,
  onUserClick,
  onStoryReact,
  onDeletePost,
  onRefresh,
  isRefreshing: externalRefreshing,
}) => {
  const { addToast } = useToast();
  const [activeFilter, setActiveFilter] = useState<FeedFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStoryGroupIndex, setSelectedStoryGroupIndex] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isRefreshActive = externalRefreshing ?? isRefreshing;

  const handleRefreshFeed = () => {
    if (onRefresh) { onRefresh(); return; }
    setIsRefreshing(true);
    addToast('Refresh is unavailable until the server refresh handler is connected.', 'info');
    setIsRefreshing(false);
  };

  // Filter posts
  const filteredPosts = posts.filter((post) => {
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchBody = post.body.toLowerCase().includes(q);
      const matchAuthor = post.authorId.toLowerCase().includes(q);
      if (!matchBody && !matchAuthor) return false;
    }

    // Filter tab
    if (activeFilter === 'following') {
      return post.privacy === 'FRIENDS' || post.authorId === currentUser.id;
    }
    if (activeFilter === 'trusted') {
      return post.privacy === 'TRUSTED_CIRCLE';
    }
    if (activeFilter === 'clips') {
      return post.contentType === 'CLIP';
    }
    if (activeFilter === 'one_time') {
      return post.privacy === 'ONE_TIME';
    }

    return true;
  });

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Stories Bar */}
      <div className="p-4 rounded-[var(--radius-3xl)] border border-subtle dark:border-subtle bg-surface dark:bg-surface shadow-token-sm">
        <StoryBar
          storyGroups={storyGroups}
          currentUser={currentUser}
          onSelectGroup={(group) => {
            const idx = storyGroups.findIndex((g) => g.user.id === group.user.id);
            if (idx !== -1) setSelectedStoryGroupIndex(idx);
          }}
          onCreateStoryClick={onCreateStory}
        />
      </div>

      {/* Post Composer */}
      <PostComposer currentUser={currentUser} onPostCreated={onCreatePost} />

      {/* Search & Feed Filter Bar */}
      <div className="space-y-3">
        {/* Search Input & Refresh button */}
        <div className="flex items-center space-x-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-tertiary" />
            <input
              type="text"
              placeholder="Search posts, hashtags, or users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-[var(--radius-2xl)] border border-subtle dark:border-subtle bg-surface dark:bg-surface text-xs text-primary dark:text-primary placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-token-sm"
            />
          </div>

          <button
            onClick={handleRefreshFeed}
            disabled={isRefreshActive}
            className="p-2.5 rounded-[var(--radius-2xl)] border border-subtle dark:border-subtle bg-surface dark:bg-surface text-secondary dark:text-secondary hover:bg-surface-soft dark:hover:bg-surface-muted transition shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshActive ? 'animate-spin text-indigo-500' : ''}`} />
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar py-1">
          {[
            { key: 'all', label: 'All Feed', icon: <Globe className="w-3.5 h-3.5" /> },
            { key: 'following', label: 'Connections', icon: <Users className="w-3.5 h-3.5" /> },
            { key: 'trusted', label: 'Trusted Circle', icon: <Star className="w-3.5 h-3.5 text-amber-500" /> },
            { key: 'clips', label: 'Clips', icon: <Film className="w-3.5 h-3.5" /> },
            { key: 'one_time', label: 'One-Time Vault', icon: <Eye className="w-3.5 h-3.5 text-rose-500" /> },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key as FeedFilter)}
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-[var(--radius-xl)] text-xs font-semibold shrink-0 transition ${
                activeFilter === f.key
                  ? 'bg-indigo-600 text-white shadow-token-md'
                  : 'bg-surface dark:bg-surface border border-subtle dark:border-subtle text-secondary dark:text-secondary hover:bg-surface-soft dark:hover:bg-surface-muted'
              }`}
            >
              {f.icon}
              <span>{f.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Feed List */}
      <div className="space-y-4">
        {filteredPosts.length > 0 ? (
          filteredPosts.map((post) => (
            <BackendPostCard
              key={post.id}
              post={post}
              currentUserId={currentUser.id}
              onLikeToggle={onLikeToggle}
              onAddComment={onAddComment}
              onUserClick={onUserClick}
              onDeletePost={onDeletePost}
            />
          ))
        ) : (
          <div className="p-12 text-center border border-subtle dark:border-subtle rounded-[var(--radius-3xl)] bg-surface dark:bg-surface space-y-2">
            <h4 className="font-bold text-primary dark:text-primary text-base">No posts found</h4>
            <p className="text-xs text-muted max-w-sm mx-auto">
              Try adjusting your search query or selecting a different feed filter.
            </p>
          </div>
        )}
      </div>

      {/* Story Viewer Modal */}
      {selectedStoryGroupIndex !== null && (
        <StoryViewerModal
          groups={storyGroups}
          initialGroupIndex={selectedStoryGroupIndex}
          currentUser={currentUser}
          onClose={() => setSelectedStoryGroupIndex(null)}
          onStoryReact={onStoryReact}
        />
      )}

    </div>
  );
};
