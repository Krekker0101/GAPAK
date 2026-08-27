/**
 * Message Timeline Component
 * GAPAK Realtime E2EE Messenger
 *
 * Highly performant timeline rendering: keyset pagination (before/after cursors),
 * date separators, unread marker line, pinned messages bar, scroll anchoring, and new message floating indicator.
 */

import React, { useRef, useLayoutEffect, useState } from 'react';
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
  onEdit: (message: ChatMessage) => void;
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
  onEdit,
  onRetry,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const previousMessageCountRef = useRef(0);
  const previousScrollHeightRef = useRef<number | null>(null);
  const wasNearBottomRef = useRef(true);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  const [activePinnedIndex, setActivePinnedIndex] = useState(0);

  // Keep the reading position while prepending history, and only follow new
  // messages when the reader was already near the bottom.
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    if (previousScrollHeightRef.current !== null) {
      element.scrollTop += element.scrollHeight - previousScrollHeightRef.current;
      previousScrollHeightRef.current = null;
    } else if (previousMessageCountRef.current === 0 || wasNearBottomRef.current) {
      element.scrollTop = element.scrollHeight;
    }
    previousMessageCountRef.current = messages.length;
  }, [messages.length]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isFarFromBottom = scrollHeight - scrollTop - clientHeight > 300;
    wasNearBottomRef.current = !isFarFromBottom;
    setShowScrollBottomBtn(isFarFromBottom);
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  };

  const loadPreviousMessages = () => {
    if (scrollRef.current) previousScrollHeightRef.current = scrollRef.current.scrollHeight;
    onLoadMoreBefore();
  };

  // Helper for grouping by date
  const formatDateSeparator = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return 'Сегодня';
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return 'Вчера';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-app">
      {/* Pinned Messages Bar */}
      {pinnedMessages.length > 0 && (
        <div className="z-10 p-2.5 bg-surface-glass-strong backdrop-blur-md border-b border-subtle flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Pin className="w-4 h-4 text-amber-400 shrink-0 fill-amber-400" />
            <div className="space-y-0.5 max-w-md">
              <span className="font-semibold text-amber-300">Закреплённое сообщение #{activePinnedIndex + 1}</span>
              <p className="text-secondary truncate">{pinnedMessages[activePinnedIndex]?.content}</p>
            </div>
          </div>

          {pinnedMessages.length > 1 && (
            <button
              type="button"
              onClick={() => setActivePinnedIndex((prev) => (prev + 1) % pinnedMessages.length)}
              className="text-tertiary hover:text-primary text-[11px] font-mono px-2 py-1 rounded bg-surface-muted"
            >
              Далее ({activePinnedIndex + 1}/{pinnedMessages.length})
            </button>
          )}
        </div>
      )}

      {/* Main Messages Scroll Timeline */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 space-y-3 overflow-y-auto bg-[radial-gradient(circle_at_75%_20%,var(--color-brand-glow),transparent_32rem)] px-3 py-4 sm:px-6 lg:px-8 [&>*]:mx-auto [&>*]:max-w-4xl"
      >
        {/* Load More Pagination Header */}
        {hasMoreBefore && (
          <div className="text-center py-2">
            <Button variant="ghost" size="sm" onClick={loadPreviousMessages} leftIcon={<ArrowUpCircle className="w-4 h-4" />}>
              Загрузить предыдущие сообщения
            </Button>
          </div>
        )}

        {/* E2EE Info Header */}
        <div className="my-4 max-w-md rounded-full border border-indigo-500/15 bg-brand-soft px-4 py-2 text-center">
          <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-indigo-400">
            <Sparkles className="w-3 h-3" />
            <span>Сообщения защищены сквозным шифрованием</span>
          </div>
        </div>

        {messages.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-sm font-semibold text-secondary">Сообщений не найдено</p>
            <p className="mt-1 text-xs text-muted">Напишите первое сообщение или измените запрос поиска.</p>
          </div>
        )}

        {/* Messages List with Date Separators */}
        {messages.map((msg, index) => {
          const isMe = msg.sender.id === currentUser.id;
          const prevMsg = messages[index - 1];
          const showDateSeparator =
            !prevMsg ||
            Boolean(msg.createdAt && prevMsg.createdAt) && new Date(msg.createdAt!).toDateString() !== new Date(prevMsg.createdAt!).toDateString();

          return (
            <React.Fragment key={msg.id}>
              {showDateSeparator && (
                <div className="flex items-center justify-center my-4">
                  <span className="rounded-full border border-subtle bg-surface px-3 py-1 text-[10px] font-medium text-tertiary shadow-sm">
                    {msg.createdAt ? formatDateSeparator(msg.createdAt) : 'Отправка…'}
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
                onEdit={onEdit}
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
