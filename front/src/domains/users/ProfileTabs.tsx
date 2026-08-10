/**
 * GAPAK Profile Subcomponent: ProfileTabs
 */

import React from 'react';
import { Grid, Film, Sparkles, Star, Users, Lock } from 'lucide-react';

export type ProfileTab = 'posts' | 'clips' | 'highlights' | 'connections' | 'trusted_circle';

interface ProfileTabsProps {
  activeTab: ProfileTab;
  onTabChange: (tab: ProfileTab) => void;
  isOwner?: boolean;
}

export const ProfileTabs: React.FC<ProfileTabsProps> = ({ activeTab, onTabChange, isOwner }) => {
  const tabs: { key: ProfileTab; label: string; icon: React.ReactNode }[] = [
    { key: 'posts', label: 'Posts', icon: <Grid className="w-4 h-4" /> },
    { key: 'clips', label: 'Clips', icon: <Film className="w-4 h-4" /> },
    { key: 'highlights', label: 'Highlights', icon: <Sparkles className="w-4 h-4" /> },
    { key: 'connections', label: 'Connections', icon: <Users className="w-4 h-4" /> },
    { key: 'trusted_circle', label: 'Trusted Circle', icon: <Star className="w-4 h-4 text-amber-500" /> },
  ];

  return (
    <div className="flex items-center space-x-1 border-b border-subtle dark:border-subtle overflow-x-auto no-scrollbar">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onTabChange(tab.key)}
          className={`flex items-center space-x-2 px-4 py-3 text-xs font-semibold border-b-2 transition shrink-0 ${
            activeTab === tab.key
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
              : 'border-transparent text-muted dark:text-tertiary hover:text-primary dark:hover:text-primary'
          }`}
        >
          {tab.icon}
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
};
