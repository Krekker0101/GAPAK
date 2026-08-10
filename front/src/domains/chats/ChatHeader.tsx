/**
 * Chat Header Component
 * GAPAK Realtime E2EE Messenger
 *
 * Header displaying active chat metadata, E2EE security indicator, typing presence,
 * trusted devices trigger, pinned messages toggle, and interactive test suite trigger.
 */

import React from 'react';
import {
  Shield,
  Lock,
  Pin,
  Users,
  Search,
  FlaskConical,
  Radio,
  Megaphone,
  MessageSquare,
} from 'lucide-react';
import { Chat, UserPresenceData } from '../../shared/types';
import { Avatar, Badge, IconButton } from '../../shared/design-system/primitives';

interface ChatHeaderProps {
  chat: Chat;
  presence?: UserPresenceData;
  typingText?: string;
  onOpenDevicesModal: () => void;
  onOpenTestModal: () => void;
  onTogglePinnedList: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  chat,
  presence,
  typingText,
  onOpenDevicesModal,
  onOpenTestModal,
  onTogglePinnedList,
}) => {
  const getChatTypeBadge = () => {
    switch (chat.type) {
      case 'DIRECT':
        return <Badge variant="neutral">Direct E2EE</Badge>;
      case 'GROUP':
        return <Badge variant="brand">Group ({chat.members.length})</Badge>;
      case 'CHANNEL':
        return <Badge variant="success">Channel Broadcast</Badge>;
      case 'BROADCAST':
        return <Badge variant="warning">Broadcast List</Badge>;
    }
  };

  return (
    <div className="p-3 bg-surface border-b border-subtle flex items-center justify-between gap-3 shrink-0">
      {/* Title & Avatar */}
      <div className="flex items-center gap-3 min-w-0">
        <Avatar name={chat.title || 'Chat'} src={chat.avatarUrl} size="md" />

        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-sm text-primary truncate">{chat.title}</h2>
            {getChatTypeBadge()}
          </div>

          <div className="flex items-center gap-2 text-xs text-tertiary">
            {typingText ? (
              <span className="text-indigo-400 font-semibold animate-pulse">{typingText}</span>
            ) : presence?.status === 'online' ? (
              <span className="text-emerald-400 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-[var(--radius-pill)] bg-emerald-400 animate-ping" />
                Online
              </span>
            ) : (
              <span className="flex items-center gap-1 text-tertiary">
                <Lock className="w-3 h-3 text-emerald-400" />
                E2EE Active
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-1 shrink-0">
        <IconButton
          icon={<Pin className="w-4 h-4 text-amber-400" />}
          ariaLabel="Pinned messages"
          onClick={onTogglePinnedList}
        />
        <IconButton
          icon={<Shield className="w-4 h-4 text-indigo-400" />}
          ariaLabel="Trusted devices"
          onClick={onOpenDevicesModal}
        />
        <IconButton
          icon={<FlaskConical className="w-4 h-4 text-purple-400" />}
          ariaLabel="E2EE Test Suite"
          onClick={onOpenTestModal}
        />
      </div>
    </div>
  );
};
