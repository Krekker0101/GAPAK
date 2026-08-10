/**
 * GAPAK Profile Subcomponent: ProfilePrivacyGuard
 */

import React from 'react';
import { Lock, Ban, ShieldAlert, UserPlus } from 'lucide-react';
import { Button } from '../../shared/design-system/primitives';

interface ProfilePrivacyGuardProps {
  type: 'private' | 'blocked' | 'restricted';
  username: string;
  onRequestAccess?: () => void;
}

export const ProfilePrivacyGuard: React.FC<ProfilePrivacyGuardProps> = ({
  type,
  username,
  onRequestAccess,
}) => {
  if (type === 'blocked') {
    return (
      <div className="p-10 rounded-[var(--radius-3xl)] border border-rose-200 dark:border-rose-900/50 bg-rose-500/5 text-center flex flex-col items-center justify-center space-y-3">
        <div className="p-4 rounded-[var(--radius-pill)] bg-rose-500/10 text-rose-500">
          <Ban className="w-8 h-8" />
        </div>
        <h3 className="font-bold text-primary dark:text-primary text-lg">Account Blocked</h3>
        <p className="text-xs text-muted dark:text-tertiary max-w-sm">
          You have blocked @{username}. Unblock them from options to view their feed and story updates.
        </p>
      </div>
    );
  }

  return (
    <div className="p-10 rounded-[var(--radius-3xl)] border border-subtle dark:border-subtle bg-surface dark:bg-surface text-center flex flex-col items-center justify-center space-y-4 shadow-token-sm">
      <div className="p-4 rounded-[var(--radius-pill)] bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
        <Lock className="w-8 h-8" />
      </div>
      <div>
        <h3 className="font-bold text-primary dark:text-primary text-lg">
          This Profile is Private
        </h3>
        <p className="text-xs text-muted dark:text-tertiary mt-1 max-w-sm">
          Follow @{username} or request a connection to access their posts, clips, and confidential trusted circle stories.
        </p>
      </div>
      {onRequestAccess && (
        <Button variant="primary" onClick={onRequestAccess} className="flex items-center space-x-2">
          <UserPlus className="w-4 h-4" />
          <span>Request Connection</span>
        </Button>
      )}
    </div>
  );
};
