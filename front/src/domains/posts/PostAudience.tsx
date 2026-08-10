/**
 * GAPAK Post Subcomponent: PostAudience
 * Displays audience visibility policy and encryption assurance indicators.
 */

import React from 'react';
import { ShieldCheck, Lock, Star, Globe, Clock, Sparkles } from 'lucide-react';
import { ContentPrivacyLevel } from '../../shared/types';

interface PostAudienceProps {
  privacy: ContentPrivacyLevel;
  isInTrustedCircle?: boolean;
  expiresAt?: string;
}

export const PostAudience: React.FC<PostAudienceProps> = ({ privacy, isInTrustedCircle, expiresAt }) => {
  if (privacy === 'PUBLIC') return null;

  return (
    <div className="mx-4 my-2 px-3 py-2 rounded-[var(--radius-xl)] bg-surface-soft dark:bg-surface-glass border border-subtle dark:border-subtle text-xs flex items-center justify-between text-secondary dark:text-tertiary">
      <div className="flex items-center space-x-2">
        <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
        <span>
          {privacy === 'TRUSTED_CIRCLE' && 'Visible exclusively to your Trusted Circle members'}
          {privacy === 'ONE_TIME' && 'Self-destruct policy active. Auto-purged upon viewing.'}
          {privacy === 'TIMED' && expiresAt && `Timed post expires on ${new Date(expiresAt).toLocaleDateString()}`}
          {privacy === 'FRIENDS' && 'Visible to direct connected contacts only'}
          {privacy === 'PRIVATE' && 'Private note — visible to you only'}
        </span>
      </div>
      <span className="text-[10px] uppercase tracking-wider font-semibold opacity-70">
        GAPAK Core Policy
      </span>
    </div>
  );
};
