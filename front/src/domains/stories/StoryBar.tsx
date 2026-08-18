import React from 'react';
import { Plus, ShieldCheck } from 'lucide-react';
import type { Story, BackendProfile } from '../../shared/api/backendContracts';
interface StoryBarProps {
  stories: Story[];
  currentUser: Pick<BackendProfile, 'id' | 'displayName'>;
  onSelectStory?: (storyId: string) => void;
  onCreateStoryClick: () => void;
}

const initials = (value: string) => value.slice(0, 2).toUpperCase();

interface StoryTile {
  key: string;
  isOwner: boolean;
  label: string;
  hasUnseen: boolean;
  onClick: () => void;
}

export const StoryBar: React.FC<StoryBarProps> = ({
  stories,
  currentUser,
  onSelectStory,
  onCreateStoryClick,
}) => {
  const tiles: StoryTile[] = (() => {
        const byAuthor = new Map<string, Story[]>();
        for (const story of stories) {
          const list = byAuthor.get(story.authorId) ?? [];
          list.push(story);
          byAuthor.set(story.authorId, list);
        }
        return [...byAuthor.entries()].map(([authorId, authorStories]) => {
          const isOwner = authorId === currentUser.id;
          return {
            key: authorId,
            isOwner,
            label: isOwner ? 'You' : authorId.slice(0, 8),
            hasUnseen: authorStories.some((story) => story.status === 'ACTIVE'),
            onClick: () => onSelectStory?.(authorStories[0].id),
          };
        });
      })();

  return <div className="flex gap-4 overflow-x-auto pb-1" aria-label="Stories">
    <button type="button" onClick={onCreateStoryClick} className="shrink-0 text-center" aria-label="Create story">
      <span className="relative grid h-16 w-16 place-items-center rounded-full border-2 border-dashed border-indigo-400 bg-surface-subtle text-indigo-600">
        <Plus size={22} />
      </span>
      <span className="mt-1 block max-w-16 truncate text-[11px] font-semibold text-primary">Your story</span>
    </button>
    {tiles.map((tile) => (
      <button key={tile.key} type="button" onClick={tile.onClick} className="shrink-0 text-center" aria-label={`Open story by ${tile.isOwner ? currentUser.displayName : tile.label}`}>
        <span className={`grid h-16 w-16 place-items-center rounded-full border-2 ${tile.hasUnseen ? 'border-indigo-500' : 'border-subtle'} bg-surface-subtle font-bold text-primary`}>
          {tile.isOwner ? initials(currentUser.displayName) : <ShieldCheck size={22} />}
        </span>
        <span className="mt-1 block max-w-16 truncate text-[11px] font-semibold text-primary">{tile.label}</span>
      </button>
    ))}
  </div>;
};
