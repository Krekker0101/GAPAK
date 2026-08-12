/**
 * Message Item Renderer Component
 * GAPAK Realtime E2EE Messenger
 *
 * Renders decrypted content, message states (sending, sent, delivered, read, failed, retrying,
 * expired, deleted, edited, encrypted, decryption_failed), attachments, voice waveforms,
 * emoji reactions, and message action menus.
 */

import React, { useState } from 'react';
import {
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  KeyRound,
  Trash2,
  Pin,
  Reply,
  MoreVertical,
  Play,
  Pause,
  Download,
  FileText,
  MapPin,
  User,
  Smile,
  Forward,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { ChatMessage, EncryptedAttachment } from '../../shared/types';
import { Avatar, Badge, IconButton } from '../../shared/design-system/primitives';
import { MentionText } from '../../shared/text/MentionText';

interface MessageItemProps {
  message: ChatMessage;
  isMe: boolean;
  onReply: (message: ChatMessage) => void;
  onReact: (messageId: string, emoji: string) => void;
  onPin: (messageId: string) => void;
  onDelete: (messageId: string) => void;
  onForward: (message: ChatMessage) => void;
  onRetry: (messageId: string) => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  isMe,
  onReply,
  onReact,
  onPin,
  onDelete,
  onForward,
  onRetry,
}) => {
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const quickEmojis = ['👍', '❤️', '🔥', '😂', '😮', '🛡️'];

  const renderStateIcon = () => {
    switch (message.state) {
      case 'sending':
        return <Clock className="w-3 h-3 text-tertiary animate-pulse" />;
      case 'sent':
        return <Check className="w-3 h-3 text-tertiary" />;
      case 'delivered':
        return <CheckCheck className="w-3 h-3 text-tertiary" />;
      case 'read':
        return <CheckCheck className="w-3 h-3 text-indigo-400" />;
      case 'failed':
        return (
          <button
            type="button"
            onClick={() => onRetry(message.id)}
            className="flex items-center gap-1 text-rose-400 hover:underline text-[10px]"
          >
            <AlertCircle className="w-3 h-3" />
            <span>Failed</span>
          </button>
        );
      case 'retrying':
        return <RotateCcw className="w-3 h-3 text-amber-400 animate-spin" />;
      default:
        return null;
    }
  };

  if (message.state === 'decryption_failed') {
    return (
      <div className={`flex my-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
        <div className="max-w-sm p-3 bg-rose-950/40 border border-rose-500/30 rounded-[var(--radius-2xl)] space-y-1 text-xs text-rose-200">
          <div className="flex items-center gap-2 font-semibold">
            <KeyRound className="w-4 h-4 text-rose-400" />
            <span>Decryption Error</span>
          </div>
          <p className="text-[11px] text-rose-300/80">
            Unable to authenticate or decrypt this message with the GAPAK E2EE protocol.
          </p>
        </div>
      </div>
    );
  }

  if (message.state === 'deleted') {
    return (
      <div className={`flex my-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
        <div className="p-2.5 bg-surface border border-subtle rounded-[var(--radius-xl)] text-xs text-muted italic">
          This message was deleted
        </div>
      </div>
    );
  }

  return (
    <div className={`group relative flex gap-3 my-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Sender Avatar if not me */}
      {!isMe && (
        <Avatar
          name={message.sender.displayName}
          src={message.sender.avatarUrl}
          size="sm"
          className="mt-1 shrink-0"
        />
      )}

      <div className={`max-w-[75%] sm:max-w-md space-y-1 ${isMe ? 'items-end' : 'items-start'}`}>
        {/* Sender Name in Group */}
        {!isMe && (
          <span className="text-[11px] font-semibold text-tertiary pl-1">
            {message.sender.displayName}
          </span>
        )}

        {/* Message Bubble Container */}
        <div
          className={`relative p-3 rounded-[var(--radius-2xl)] shadow-token-md transition-all ${
            isMe
              ? 'bg-indigo-600 text-white rounded-tr-xs'
              : 'bg-surface border border-subtle text-primary rounded-tl-xs'
          } ${message.pinned ? 'ring-1 ring-amber-500/50' : ''}`}
        >
          {/* Pinned Indicator */}
          {message.pinned && (
            <div className="flex items-center gap-1 text-[10px] text-amber-400 font-medium mb-1">
              <Pin className="w-3 h-3 fill-amber-400" />
              <span>Pinned Message</span>
            </div>
          )}

          {/* Reply Quote Banner */}
          {message.replyTo && (
            <div className={`p-2 rounded-[var(--radius-lg)] text-xs mb-2 border-l-2 ${
              isMe ? 'bg-indigo-700/60 border-indigo-300 text-indigo-100' : 'bg-app border-indigo-500 text-secondary'
            }`}>
              <p className="font-semibold text-[10px] opacity-80">{message.replyTo.sender.displayName}</p>
              <p className="truncate text-[11px]">{message.replyTo.content}</p>
            </div>
          )}

          {/* Voice Message Player */}
          {message.contentType === 'VOICE' && message.voice && (
            <div className="flex items-center gap-3 py-1 min-w-[200px]">
              <button
                type="button"
                onClick={() => setIsPlayingVoice(!isPlayingVoice)}
                className={`p-2 rounded-[var(--radius-pill)] transition-colors ${
                  isMe ? 'bg-surface text-indigo-600' : 'bg-indigo-600 text-white'
                }`}
              >
                {isPlayingVoice ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>

              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-1 h-6">
                  {message.voice.waveform.map((bar, i) => (
                    <div
                      key={i}
                      className={`w-1 rounded-[var(--radius-pill)] transition-all ${
                        isPlayingVoice ? 'animate-pulse bg-emerald-400' : isMe ? 'bg-indigo-300' : 'bg-surface-stronger'
                      }`}
                      style={{ height: `${Math.max(20, bar)}%` }}
                    />
                  ))}
                </div>
                <div className="flex justify-between text-[10px] opacity-75">
                  <span>0:00</span>
                  <span>0:{message.voice.durationSeconds.toString().padStart(2, '0')}</span>
                </div>
              </div>
            </div>
          )}

          {/* Text Body */}
          {message.content && message.contentType !== 'VOICE' && (
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words"><MentionText text={message.content} /></p>
          )}

          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="space-y-2 mt-2">
              {message.attachments.map((att) => (
                <div key={att.id} className="rounded-[var(--radius-xl)] overflow-hidden border border-subtle">
                  {att.type === 'image' ? (
                    <img
                      src={att.encryptedBlobUrl}
                      alt={att.name}
                      onClick={() => setSelectedImage(att.encryptedBlobUrl)}
                      className="w-full max-h-60 object-cover rounded-[var(--radius-xl)] cursor-pointer hover:opacity-90"
                    />
                  ) : (
                    <div className={`p-2.5 rounded-[var(--radius-xl)] flex items-center justify-between text-xs ${
                      isMe ? 'bg-indigo-700/50' : 'bg-app'
                    }`}>
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-indigo-400" />
                        <div>
                          <p className="font-semibold truncate max-w-[150px]">{att.name}</p>
                          <p className="text-[10px] opacity-75">{(att.sizeBytes / 1024).toFixed(1)} KB • E2EE</p>
                        </div>
                      </div>
                      <IconButton icon={<Download className="w-3.5 h-3.5" />} ariaLabel="Download" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Footer Metadata */}
          <div className={`flex items-center gap-1.5 justify-end text-[10px] mt-1 ${
            isMe ? 'text-indigo-200' : 'text-tertiary'
          }`}>
            <span>{message.createdAt ? new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Sending…'}</span>
            {isMe && renderStateIcon()}
          </div>
        </div>

        {/* Reaction Chips */}
        {message.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1 pl-1">
            {message.reactions.map((r, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onReact(message.id, r.emoji)}
                className={`px-2 py-0.5 rounded-[var(--radius-pill)] text-xs border flex items-center gap-1 transition-colors ${
                  r.reactedByMe
                    ? 'bg-indigo-950/60 border-indigo-500/50 text-indigo-300'
                    : 'bg-surface border-subtle text-secondary hover:bg-surface-muted'
                }`}
              >
                <span>{r.emoji}</span>
                <span className="font-mono text-[10px] font-bold">{r.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Hover Quick Actions Bar */}
      <div className={`opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 self-center ${
        isMe ? 'flex-row-reverse' : 'flex-row'
      }`}>
        <IconButton
          icon={<Smile className="w-3.5 h-3.5" />}
          ariaLabel="React"
          size="sm"
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
        />
        <IconButton
          icon={<Reply className="w-3.5 h-3.5" />}
          ariaLabel="Reply"
          size="sm"
          onClick={() => onReply(message)}
        />
        <IconButton
          icon={<MoreVertical className="w-3.5 h-3.5" />}
          ariaLabel="Options"
          size="sm"
          onClick={() => setShowMenu(!showMenu)}
        />

        {/* Emoji Quick Picker Dropdown */}
        {showEmojiPicker && (
          <div className="absolute bottom-full mb-1 z-30 p-1.5 bg-surface border border-subtle rounded-[var(--radius-pill)] shadow-token-lg flex items-center gap-1">
            {quickEmojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onReact(message.id, emoji);
                  setShowEmojiPicker(false);
                }}
                className="hover:scale-125 transition-transform p-1 text-sm"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Context Menu Dropdown */}
        {showMenu && (
          <div className="absolute top-full mt-1 z-30 w-40 bg-surface border border-subtle rounded-[var(--radius-xl)] shadow-token-lg p-1 text-xs space-y-0.5">
            <button
              type="button"
              onClick={() => {
                onPin(message.id);
                setShowMenu(false);
              }}
              className="w-full text-left px-2.5 py-1.5 rounded-[var(--radius-lg)] hover:bg-surface-muted flex items-center gap-2 text-primary"
            >
              <Pin className="w-3.5 h-3.5 text-amber-400" />
              <span>{message.pinned ? 'Unpin Message' : 'Pin Message'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onForward(message);
                setShowMenu(false);
              }}
              className="w-full text-left px-2.5 py-1.5 rounded-[var(--radius-lg)] hover:bg-surface-muted flex items-center gap-2 text-primary"
            >
              <Forward className="w-3.5 h-3.5 text-indigo-400" />
              <span>Forward</span>
            </button>
            {isMe && (
              <button
                type="button"
                onClick={() => {
                  onDelete(message.id);
                  setShowMenu(false);
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-[var(--radius-lg)] hover:bg-rose-500/10 flex items-center gap-2 text-rose-400"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Image Lightbox Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setSelectedImage(null)}
        >
          <img src={selectedImage} alt="Expanded Media" className="max-w-full max-h-[90vh] rounded-[var(--radius-2xl)] object-contain" />
        </div>
      )}
    </div>
  );
};
