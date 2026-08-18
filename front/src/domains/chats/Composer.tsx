/** Text composer for the backend-supported TRUSTED_CHAT message contract. */
import React, { useEffect, useState } from 'react';
import { Send, X } from 'lucide-react';
import type { ChatMessage, MessageContentType } from '../../shared/types';
import { IconButton } from '../../shared/design-system/primitives';
import { messageCacheManager } from './cache/MessageCacheManager';

interface ComposerProps {
  chatId: string;
  replyingTo: ChatMessage | null;
  onCancelReply: () => void;
  onSendMessage: (payload: {
    content: string;
    contentType: MessageContentType;
    replyToMessageId?: string;
  }) => void;
  onTyping: () => void;
}

export const Composer: React.FC<ComposerProps> = ({
  chatId,
  replyingTo,
  onCancelReply,
  onSendMessage,
  onTyping,
}) => {
  const [text, setText] = useState('');

  useEffect(() => {
    setText(messageCacheManager.getDraft(chatId));
  }, [chatId]);

  const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    setText(value);
    messageCacheManager.setDraft(chatId, value);
    onTyping();
  };

  const handleSend = () => {
    const content = text.trim();
    if (!content) return;
    onSendMessage({
      content,
      contentType: 'TEXT',
      replyToMessageId: replyingTo?.id,
    });
    setText('');
    messageCacheManager.setDraft(chatId, '');
    if (replyingTo) onCancelReply();
  };

  return (
    <div className="space-y-2 border-t border-subtle bg-surface p-3">
      {replyingTo && (
        <div className="flex items-center justify-between rounded-[var(--radius-xl)] border border-subtle bg-app p-2.5 text-xs">
          <div className="max-w-md space-y-0.5">
            <span className="font-semibold text-indigo-400">Replying to {replyingTo.sender.displayName}</span>
            <p className="truncate text-secondary">{replyingTo.content}</p>
          </div>
          <IconButton icon={<X className="h-4 w-4 text-tertiary" />} ariaLabel="Cancel reply" onClick={onCancelReply} size="sm" />
        </div>
      )}

      <div className="flex items-end gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-[var(--radius-2xl)] border border-subtle bg-app p-2 focus-within:border-indigo-500/50">
          <textarea
            value={text}
            onChange={handleTextChange}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type an end-to-end encrypted message..."
            rows={1}
            className="max-h-24 w-full resize-none bg-transparent text-sm text-primary outline-none placeholder-slate-500"
          />
        </div>
        <button
          type="button"
          aria-label="Send message"
          disabled={!text.trim()}
          onClick={handleSend}
          className="rounded-[var(--radius-2xl)] bg-indigo-600 p-3 text-white shadow-token-lg transition-all hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};
