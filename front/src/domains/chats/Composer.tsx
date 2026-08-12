/**
 * Message Composer Component
 * GAPAK Realtime E2EE Messenger
 *
 * Rich input composer with attachment uploads, voice recording UX, disappearing messages timer,
 * reply preview, typing broadcasts, draft persistence, and sticker/emoji picker.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Paperclip,
  Mic,
  MicOff,
  Image,
  FileText,
  Smile,
  X,
  Clock,
  Sparkles,
  Square,
  Flame,
} from 'lucide-react';
import { ChatMessage, MessageContentType, EncryptedAttachment } from '../../shared/types';
import { IconButton, Badge } from '../../shared/design-system/primitives';
import { messageCacheManager } from './cache/MessageCacheManager';
import { e2eeCryptoEngine } from './crypto/E2EECryptoEngine';

interface ComposerProps {
  chatId: string;
  replyingTo: ChatMessage | null;
  onCancelReply: () => void;
  onSendMessage: (payload: {
    content: string;
    contentType: MessageContentType;
    attachments?: EncryptedAttachment[];
    voice?: { durationSeconds: number; waveform: number[] };
    ephemeralTimerSeconds?: number;
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
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [selectedAttachments, setSelectedAttachments] = useState<EncryptedAttachment[]>([]);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [ephemeralTimer, setEphemeralTimer] = useState<number>(0); // 0 = off
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showEphemeralMenu, setShowEphemeralMenu] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load saved draft
  useEffect(() => {
    setText(messageCacheManager.getDraft(chatId));
  }, [chatId]);

  // Save draft on text change
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    messageCacheManager.setDraft(chatId, val);
    onTyping();
  };

  // Voice recording simulation
  const startVoiceRecording = () => {
    setIsRecordingVoice(true);
    setRecordingDuration(0);
    recordingTimerRef.current = setInterval(() => {
      setRecordingDuration((prev) => prev + 1);
    }, 1000);
  };

  const stopAndSendVoiceRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecordingVoice(false);

    onSendMessage({
      content: 'Voice Message',
      contentType: 'VOICE',
      voice: {
        durationSeconds: Math.max(1, recordingDuration),
        waveform: Array.from({ length: 15 }, () => Math.floor(Math.random() * 80) + 20),
      },
      ephemeralTimerSeconds: ephemeralTimer,
      replyToMessageId: replyingTo?.id,
    });
    setRecordingDuration(0);
    if (replyingTo) onCancelReply();
  };

  const cancelVoiceRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecordingVoice(false);
    setRecordingDuration(0);
  };

  // Attachment upload simulator
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingAttachment(true);
    setAttachmentError(null);
    const file = files[0];
    try {
      const encryptedAttachment = await e2eeCryptoEngine.encryptAttachment(file);
      setSelectedAttachments((prev) => [...prev, encryptedAttachment]);
      setShowAttachmentMenu(false);
    } catch (error) {
      setAttachmentError(error instanceof Error ? error.message : 'Encrypted attachments are not available.');
    } finally {
      setIsUploadingAttachment(false);
      e.target.value = '';
    }
  };

  const handleSend = () => {
    if (!text.trim() && selectedAttachments.length === 0) return;

    onSendMessage({
      content: text,
      contentType: selectedAttachments.length > 0 ? 'IMAGE' : 'TEXT',
      attachments: selectedAttachments,
      ephemeralTimerSeconds: ephemeralTimer,
      replyToMessageId: replyingTo?.id,
    });

    setText('');
    setSelectedAttachments([]);
    messageCacheManager.setDraft(chatId, '');
    if (replyingTo) onCancelReply();
  };

  const ephemeralOptions = [
    { label: 'Off', value: 0 },
    { label: '5 Seconds', value: 5 },
    { label: '1 Minute', value: 60 },
    { label: '1 Hour', value: 3600 },
    { label: '24 Hours', value: 86400 },
  ];

  return (
    <div className="p-3 bg-surface border-t border-subtle space-y-2">
      {/* Reply Preview Bar */}
      {replyingTo && (
        <div className="p-2.5 bg-app border border-subtle rounded-[var(--radius-xl)] flex items-center justify-between text-xs">
          <div className="space-y-0.5 max-w-md">
            <span className="font-semibold text-indigo-400">Replying to {replyingTo.sender.displayName}</span>
            <p className="text-secondary truncate">{replyingTo.content}</p>
          </div>
          <IconButton icon={<X className="w-4 h-4 text-tertiary" />} ariaLabel="Cancel reply" onClick={onCancelReply} size="sm" />
        </div>
      )}

      {/* Selected Attachments Preview */}
      {attachmentError && (
        <div role="alert" className="mb-2 rounded-[var(--radius-xl)] border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
          {attachmentError}
        </div>
      )}

      {selectedAttachments.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {selectedAttachments.map((att) => (
            <div key={att.id} className="relative p-2 bg-app border border-subtle rounded-[var(--radius-xl)] flex items-center gap-2 text-xs">
              <span className="truncate max-w-[120px] text-primary">{att.name}</span>
              <button
                type="button"
                onClick={() => setSelectedAttachments((prev) => prev.filter((a) => a.id !== att.id))}
                className="text-tertiary hover:text-rose-400"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Voice Recording Active UX */}
      {isRecordingVoice ? (
        <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-[var(--radius-2xl)] flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-600 text-white rounded-[var(--radius-pill)]">
              <Mic className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-xs text-rose-200">Recording Voice Note...</p>
              <p className="text-xs font-mono text-rose-300">0:{recordingDuration.toString().padStart(2, '0')}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cancelVoiceRecording}
              className="px-3 py-1.5 rounded-[var(--radius-lg)] bg-surface border border-subtle text-secondary hover:text-primary text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={stopAndSendVoiceRecording}
              className="px-4 py-1.5 rounded-[var(--radius-lg)] bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send Voice</span>
            </button>
          </div>
        </div>
      ) : (
        /* Main Input Bar */
        <div className="flex items-end gap-2">
          {/* Attachment Menu Trigger */}
          <div className="relative">
            <IconButton
              icon={<Paperclip className="w-5 h-5" />}
              ariaLabel="Attach files"
              onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
            />

            {showAttachmentMenu && (
              <div className="absolute bottom-full mb-2 left-0 z-30 w-44 bg-surface border border-subtle rounded-[var(--radius-2xl)] shadow-token-lg p-1 text-xs space-y-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full p-2 rounded-[var(--radius-xl)] hover:bg-surface-muted flex items-center gap-2.5 text-primary"
                >
                  <Image className="w-4 h-4 text-purple-400" />
                  <span>Photo / Video</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full p-2 rounded-[var(--radius-xl)] hover:bg-surface-muted flex items-center gap-2.5 text-primary"
                >
                  <FileText className="w-4 h-4 text-indigo-400" />
                  <span>Document</span>
                </button>
              </div>
            )}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {/* Disappearing Messages Timer Trigger */}
          <div className="relative">
            <IconButton
              icon={<Flame className={`w-5 h-5 ${ephemeralTimer > 0 ? 'text-amber-400 fill-amber-400/20' : ''}`} />}
              ariaLabel="Disappearing timer"
              onClick={() => setShowEphemeralMenu(!showEphemeralMenu)}
            />

            {showEphemeralMenu && (
              <div className="absolute bottom-full mb-2 left-0 z-30 w-44 bg-surface border border-subtle rounded-[var(--radius-2xl)] shadow-token-lg p-1 text-xs space-y-1">
                <p className="px-2.5 py-1 text-[10px] font-mono text-tertiary uppercase">Disappearing Messages</p>
                {ephemeralOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setEphemeralTimer(opt.value);
                      setShowEphemeralMenu(false);
                    }}
                    className={`w-full p-2 rounded-[var(--radius-xl)] text-left flex items-center justify-between ${
                      ephemeralTimer === opt.value
                        ? 'bg-amber-950/40 text-amber-300 font-semibold'
                        : 'hover:bg-surface-muted text-secondary'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {ephemeralTimer === opt.value && <Flame className="w-3.5 h-3.5 text-amber-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Text Area */}
          <div className="flex-1 bg-app border border-subtle rounded-[var(--radius-2xl)] p-2 flex items-center gap-2 focus-within:border-indigo-500/50">
            <textarea
              value={text}
              onChange={handleTextChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Type an end-to-end encrypted message..."
              rows={1}
              className="w-full bg-transparent text-sm text-primary placeholder-slate-500 outline-none resize-none max-h-24"
            />
          </div>

          {/* Voice Record / Send Button */}
          {text.trim() || selectedAttachments.length > 0 ? (
            <button
              type="button"
              onClick={handleSend}
              className="p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[var(--radius-2xl)] shadow-token-lg transition-all"
            >
              <Send className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={startVoiceRecording}
              className="p-3 bg-surface-muted hover:bg-surface-strong text-primary rounded-[var(--radius-2xl)] transition-all"
            >
              <Mic className="w-5 h-5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
