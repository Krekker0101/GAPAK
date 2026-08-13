/**
 * GAPAK Live Chat Component
 * Phase 4 - Live Domain Architecture
 *
 * Public/Room live stream chat feed with rate-limiting cooldown, optimistic messages,
 * system join/leave events, pinned messages banner, and floating heart reactions.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Heart,
  Pin,
  Clock,
  Sparkles,
  Shield,
  MessageSquare,
  AlertCircle,
} from 'lucide-react';
import { LiveChatMessage, LiveStreamEvent } from '../../shared/types';
import { LiveStreamService } from './LiveStreamService';
import { Avatar, Badge, IconButton } from '../../shared/design-system/primitives';

interface LiveChatProps {
  streamId: string;
  className?: string;
  onSendLike: () => void;
}

export const LiveChat: React.FC<LiveChatProps> = ({ streamId, className = '', onSendLike }) => {
  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [events, setEvents] = useState<LiveStreamEvent[]>([]);
  const [inputText, setInputText] = useState('');
  const [cooldownSec, setCooldownSec] = useState(0);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);

  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubChat = LiveStreamService.subscribeChat(streamId, setMessages);
    const unsubEvents = LiveStreamService.subscribeEvents(streamId, setEvents);
    return () => {
      unsubChat();
      unsubEvents();
    };
  }, [streamId]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Cooldown timer tick
  useEffect(() => {
    if (cooldownSec <= 0) return;
    const timer = setInterval(() => {
      setCooldownSec((prev) => {
        if (prev <= 1) {
          setRateLimitError(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSec]);

  const handleSend = () => {
    if (!inputText.trim() || cooldownSec > 0) return;

    // Client-side idempotency key: safe to resend this exact call (e.g. from a
    // future retry-with-backoff path) without creating a duplicate message.
    const clientMessageId = crypto.randomUUID();
    const res = LiveStreamService.sendChatMessage(streamId, inputText.trim(), clientMessageId);
    if (res.success) {
      setInputText('');
      setRateLimitError(null);
    } else if (res.cooldownSec) {
      // Rejected before send (rate limit): input text is intentionally left
      // untouched so the user doesn't lose what they typed.
      setCooldownSec(res.cooldownSec);
      setRateLimitError(res.error || 'Rate limit active');
    }
  };

  const handleRetry = (targetStreamId: string, clientMessageId: string) => {
    const res = LiveStreamService.retryChatMessage(targetStreamId, clientMessageId);
    if (!res.success) setRateLimitError(res.error || 'Retry failed');
  };

  const pinnedMsg = messages.find((m) => m.isPinned);

  return (
    <div className={`flex flex-col h-full bg-slate-900 border-l border-slate-800 ${className}`}>
      {/* Header */}
      <div className="p-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-indigo-400" />
          <h3 className="font-bold text-xs text-slate-100">Live Room Chat</h3>
        </div>
        <Badge variant="neutral">Public Feed</Badge>
      </div>

      {/* Pinned Message Banner */}
      {pinnedMsg && (
        <div className="p-2.5 bg-indigo-950/40 border-b border-indigo-500/30 flex items-start gap-2 text-xs">
          <Pin className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5 min-w-0">
            <span className="font-semibold text-amber-300 text-[10px]">Pinned Announcement</span>
            <p className="text-slate-200 text-[11px] truncate">{pinnedMsg.text}</p>
          </div>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 text-xs">
        {messages.map((msg) => {
          if (msg.isSystem) {
            return (
              <div key={msg.id} className="p-2 bg-slate-950/60 border border-slate-800/80 rounded-xl text-[10px] text-slate-400 text-center italic">
                {msg.text}
              </div>
            );
          }

          return (
            <div key={msg.id} className="flex items-start gap-2 group">
              <Avatar name={msg.sender.displayName} src={msg.sender.avatarUrl} size="sm" className="mt-0.5 shrink-0" />
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-[11px] text-slate-200">{msg.sender.displayName}</span>
                  {msg.badges?.map((b) => (
                    <span key={b} className="px-1 py-0.2 bg-indigo-600/60 text-white text-[9px] font-mono font-bold rounded">
                      {b}
                    </span>
                  ))}
                  <span className="text-[9px] text-slate-500">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {/* text is always rendered from the message object itself, never cleared on failure */}
                <p className="text-slate-300 text-xs leading-relaxed break-words">{msg.text}</p>
                {msg.status === 'pending' && (
                  <span className="flex items-center gap-1 text-[9px] text-slate-500">
                    <Clock className="w-2.5 h-2.5 animate-pulse" /> Sending…
                  </span>
                )}
                {msg.status === 'failed' && (
                  <button
                    type="button"
                    onClick={() => msg.clientMessageId && handleRetry(msg.streamId, msg.clientMessageId)}
                    className="flex items-center gap-1 text-[9px] text-rose-400 hover:underline"
                  >
                    <AlertCircle className="w-2.5 h-2.5" /> Failed — tap to retry
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <div ref={chatBottomRef} />
      </div>

      {/* Rate Limit Alert */}
      {rateLimitError && (
        <div className="px-3 py-1 bg-amber-950/60 border-t border-amber-500/40 text-amber-300 text-[10px] flex items-center justify-between">
          <span className="flex items-center gap-1">
            <AlertCircle className="w-3 h-3 text-amber-400" />
            <span>{rateLimitError}</span>
          </span>
          <span className="font-mono font-bold">{cooldownSec}s</span>
        </div>
      )}

      {/* Input Footer */}
      <div className="p-3 border-t border-slate-800 bg-slate-950 flex items-center gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={cooldownSec > 0}
          placeholder={cooldownSec > 0 ? `Rate limit active (${cooldownSec}s)...` : "Say something in live room..."}
          className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500"
        />

        <button
          type="button"
          onClick={onSendLike}
          className="p-2.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 rounded-xl border border-rose-500/30 transition-transform active:scale-125"
          title="Send Heart"
        >
          <Heart className="w-4 h-4 fill-rose-400" />
        </button>

        <button
          type="button"
          onClick={handleSend}
          disabled={!inputText.trim() || cooldownSec > 0}
          className="p-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl transition-all"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
