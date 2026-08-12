import React from 'react';
import { Plus, ShieldCheck } from 'lucide-react';
import type { Story, BackendProfile } from '../../shared/api/backendContracts';

interface StoryBarProps {
  stories: Story[];
  currentUser: BackendProfile;
  onSelectStory: (storyId: string) => void;
  onCreateStoryClick: () => void;
}

const initials = (value: string) => value.slice(0, 2).toUpperCase();

export const StoryBar: React.FC<StoryBarProps> = ({ stories, currentUser, onSelectStory, onCreateStoryClick }) => {
  const byAuthor = new Map<string, Story[]>();
  for (const story of stories) {
    const list = byAuthor.get(story.authorId) ?? [];
    list.push(story);
    byAuthor.set(story.authorId, list);
  }

  return <div className="flex gap-4 overflow-x-auto pb-1" aria-label="Stories">
    <button type="button" onClick={onCreateStoryClick} className="shrink-0 text-center" aria-label="Create story">
      <span className="relative grid h-16 w-16 place-items-center rounded-full border-2 border-dashed border-indigo-400 bg-surface-subtle text-indigo-600">
        <Plus size={22} />
      </span>
      <span className="mt-1 block max-w-16 truncate text-[11px] font-semibold text-primary">Your story</span>
    </button>
    {[...byAuthor.entries()].map(([authorId, authorStories]) => {
      const first = authorStories[0];
      const isOwner = authorId === currentUser.id;
      const hasUnseen = authorStories.some(story => story.status === 'ACTIVE');
      return <button key={authorId} type="button" onClick={() => onSelectStory(first.id)} className="shrink-0 text-center" aria-label={`Open story by ${isOwner ? currentUser.displayName : authorId}`}>
        <span className={`grid h-16 w-16 place-items-center rounded-full border-2 ${hasUnseen ? 'border-indigo-500' : 'border-subtle'} bg-surface-subtle font-bold text-primary`}>
          {isOwner ? initials(currentUser.displayName) : <ShieldCheck size={22} />}
        </span>
        <span className="mt-1 block max-w-16 truncate text-[11px] font-semibold text-primary">{isOwner ? 'You' : authorId.slice(0, 8)}</span>
      </button>;
    })}
  </div>;
};
