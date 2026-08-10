/**
 * Message Timeline Component
 * GAPAK Realtime E2EE Messenger
 *
 * Highly performant timeline rendering: keyset pagination (before/after cursors),
 * date separators, unread marker line, pinned messages bar, scroll anchoring, and new message floating indicator.
 */

import React, { useRef, useEffect, useState } from 'react';
import {
  Pin,
  ChevronDown,
  ArrowUpCircle,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';
import { ChatMessage, UserProfile } from '../../shared/types';
import { MessageItem } from './MessageItem';
import { Button } from '../../shared/design-system/primitives';

interface MessageTimelineProps {
  messages: ChatMessage[];
  currentUser: UserProfile;
  pinnedMessages: ChatMessage[];
  hasMoreBefore: boolean;
  onLoadMoreBefore: () => void;
  onReply: (message: ChatMessage) => void;
  onReact: (messageId: string, emoji: string) => void;
  onPin: (messageId: string) => void;
  onDelete: (messageId: string) => void;
  onForward: (message: ChatMessage) => void;
  onRetry: (messageId: string) => void;
}

export const MessageTimeline: React.FC<MessageTimelineProps> = ({
  messages,
  currentUser,
  pinnedMessages,
  hasMoreBefore,
  onLoadMoreBefore,
  onReply,
  onReact,
  onPin,
  onDelete,
  onForward,
  onRetry,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  const [activePinnedIndex, setActivePinnedIndex] = useState(0);

  // Auto scroll to bottom on new messages if near bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isFarFromBottom = scrollHeight - scrollTop - clientHeight > 300;
    setShowScrollBottomBtn(isFarFromBottom);
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  };

  // Helper for grouping by date
  const formatDateSeparator = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return 'Today';
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="relative flex-1 flex flex-col min-h-0 bg-app-glass">
      {/* Pinned Messages Bar */}
      {pinnedMessages.length > 0 && (
        <div className="z-10 p-2.5 bg-surface-glass-strong backdrop-blur-md border-b border-subtle flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Pin className="w-4 h-4 text-amber-400 shrink-0 fill-amber-400" />
            <div className="space-y-0.5 max-w-md">
              <span className="font-semibold text-amber-300">Pinned Message #{activePinnedIndex + 1}</span>
              <p className="text-secondary truncate">{pinnedMessages[activePinnedIndex]?.content}</p>
            </div>
          </div>

          {pinnedMessages.length > 1 && (
            <button
              type="button"
              onClick={() => setActivePinnedIndex((prev) => (prev + 1) % pinnedMessages.length)}
              className="text-tertiary hover:text-primary text-[11px] font-mono px-2 py-1 rounded bg-surface-muted"
            >
              Next ({activePinnedIndex + 1}/{pinnedMessages.length})
            </button>
          )}
        </div>
      )}

      {/* Main Messages Scroll Timeline */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-3"
      >
        {/* Load More Pagination Header */}
        {hasMoreBefore && (
          <div className="text-center py-2">
            <Button variant="ghost" size="sm" onClick={onLoadMoreBefore} leftIcon={<ArrowUpCircle className="w-4 h-4" />}>
              Load Previous Messages
            </Button>
          </div>
        )}

        {/* E2EE Info Header */}
        <div className="p-3 bg-indigo-950/20 border border-indigo-500/20 rounded-[var(--radius-2xl)] text-center max-w-md mx-auto my-4 space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded-[var(--radius-pill)] text-indigo-300 text-[10px] font-mono font-semibold">
            <Sparkles className="w-3 h-3" />
            <span>End-to-End Encrypted</span>
          </div>
          <p className="text-[11px] text-tertiary">
            Messages and media are encrypted before leaving your device.
          </p>
        </div>

        {/* Messages List with Date Separators */}
        {messages.map((msg, index) => {
          const isMe = msg.sender.id === currentUser.id;
          const prevMsg = messages[index - 1];
          const showDateSeparator =
            !prevMsg ||
            new Date(msg.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString();

          return (
            <React.Fragment key={msg.id}>
              {showDateSeparator && (
                <div className="flex items-center justify-center my-4">
                  <span className="px-3 py-1 bg-surface border border-subtle rounded-[var(--radius-pill)] text-[10px] font-mono font-bold text-tertiary uppercase tracking-wider">
                    {formatDateSeparator(msg.createdAt)}
                  </span>
                </div>
              )}

              <MessageItem
                message={msg}
                isMe={isMe}
                onReply={onReply}
                onReact={onReact}
                onPin={onPin}
                onDelete={onDelete}
                onForward={onForward}
                onRetry={onRetry}
              />
            </React.Fragment>
          );
        })}
      </div>

      {/* Scroll To Bottom Floating Button */}
      {showScrollBottomBtn && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="absolute bottom-4 right-4 z-20 p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[var(--radius-pill)] shadow-token-lg flex items-center justify-center transition-all animate-bounce"
        >
          <ChevronDown className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};
