/**
 * GAPAK Post Subcomponent: PostBody
 */

import React, { useState } from 'react';
import { MentionText } from '../../shared/text/MentionText';

interface PostBodyProps {
  body: string;
  audienceTags?: string[];
  maxCharactersBeforeTruncate?: number;
}

export const PostBody: React.FC<PostBodyProps> = ({
  body,
  audienceTags = [],
  maxCharactersBeforeTruncate = 280,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!body && audienceTags.length === 0) return null;

  const shouldTruncate = body.length > maxCharactersBeforeTruncate && !isExpanded;
  const displayedText = shouldTruncate ? body.substring(0, maxCharactersBeforeTruncate) + '...' : body;



  return (
    <div className="px-4 py-2 space-y-2 text-primary dark:text-primary text-sm leading-relaxed whitespace-pre-line">
      <p>
        <MentionText text={displayedText} />{' '}
        {shouldTruncate && (
          <button
            onClick={() => setIsExpanded(true)}
            className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline text-xs ml-1"
          >
            Show More
          </button>
        )}
      </p>

      {/* Tags */}
      {audienceTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {audienceTags.map((tag, idx) => (
            <span
              key={idx}
              className="text-xs font-medium px-2 py-0.5 rounded-[var(--radius-md)] bg-surface-subtle dark:bg-surface-glass text-secondary dark:text-tertiary"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
