/**
 * GAPAK Post Subcomponent: PostFooter
 */

import React from 'react';
import { Eye, ShieldAlert } from 'lucide-react';

interface PostFooterProps {
  createdAt: string;
  sharesCount: number;
}

export const PostFooter: React.FC<PostFooterProps> = ({ createdAt, sharesCount }) => {
  return (
    <div className="px-4 pb-3 flex items-center justify-between text-[11px] text-tertiary dark:text-muted">
      <span>Published {new Date(createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
      {sharesCount > 0 && <span>{sharesCount} reposts</span>}
    </div>
  );
};
