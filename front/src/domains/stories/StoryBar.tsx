/**
 * GAPAK StoryBar
 * Horizontal story circles list with active gradient rings.
 */

import React from 'react';
import { Plus, Sparkles } from 'lucide-react';
import { UserStoryGroup, UserProfile } from '../../shared/types';
import { Avatar } from '../../shared/design-system/primitives';

interface StoryBarProps {
  storyGroups: UserStoryGroup[];
  currentUser: UserProfile;
  onSelectGroup: (group: UserStoryGroup, storyIndex?: number) => void;
  onCreateStoryClick: () => void;
}

export const StoryBar: React.FC<StoryBarProps> = ({
  storyGroups,
  currentUser,
  onSelectGroup,
  onCreateStoryClick,
}) => {
  return (
    <div className="flex items-center space-x-4 overflow-x-auto py-2 px-1 no-scrollbar">
      {/* Create Story Button */}
      <button
        onClick={onCreateStoryClick}
        className="flex flex-col items-center space-y-1.5 shrink-0 group focus:outline-none"
      >
        <div className="relative w-16 h-16 rounded-[var(--radius-pill)] bg-surface-subtle dark:bg-surface-muted border-2 border-dashed border-default dark:border-default flex items-center justify-center group-hover:border-indigo-500 transition">
          <Avatar
            src={currentUser.avatarUrl}
            alt={currentUser.displayName}
            fallback={currentUser.displayName[0]}
            size="lg"
            className="opacity-75 group-hover:opacity-100 transition"
          />
          <div className="absolute bottom-0 right-0 p-1 rounded-[var(--radius-pill)] bg-indigo-600 text-white border-2 border-white dark:border-strong">
            <Plus className="w-3.5 h-3.5" />
          </div>
        </div>
        <span className="text-[11px] font-semibold text-secondary dark:text-secondary group-hover:text-indigo-500">
          Your Story
        </span>
      </button>

      {/* Story Groups */}
      {storyGroups.map((group) => {
        const isSelf = group.user.id === currentUser.id;
        if (isSelf && group.stories.length === 0) return null;

        return (
          <button
            key={group.user.id}
            onClick={() => onSelectGroup(group)}
            className="flex flex-col items-center space-y-1.5 shrink-0 group focus:outline-none"
          >
            <div
              className={`p-[2.5px] rounded-[var(--radius-pill)] transition-all ${
                group.hasUnseenStories
                  ? 'bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 scale-105'
                  : 'bg-surface-hover dark:bg-surface-strong'
              }`}
            >
              <div className="p-0.5 bg-surface dark:bg-surface rounded-[var(--radius-pill)]">
                <Avatar
                  src={group.user.avatarUrl}
                  alt={group.user.displayName}
                  fallback={group.user.displayName[0]}
                  size="lg"
                  presence={group.user.presence}
                />
              </div>
            </div>
            <span className="text-[11px] font-medium text-secondary dark:text-secondary truncate max-w-[70px]">
              {group.user.username}
            </span>
          </button>
        );
      })}
    </div>
  );
};
