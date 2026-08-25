/** Text composer for the backend-supported TRUSTED_CHAT message contract. */
import React, { useEffect, useRef, useState } from 'react';
import { Mic, Paperclip, Send, Square, X } from 'lucide-react';
import type { ChatMessage, EncryptedAttachment, MediaUploadItem, MessageContentType } from '../../shared/types';
import { IconButton } from '../../shared/design-system/primitives';
import { messageCacheManager } from './cache/MessageCacheManager';
import { MediaUploadSubsystem } from '../media/MediaUploadSubsystem';
import { globalUploadManager } from '../media/GlobalUploadManager';

interface ComposerProps {
  chatId: string;
  replyingTo: ChatMessage | null;
  editingMessage: ChatMessage | null;
  onCancelReply: () => void;
  onCancelEdit: () => void;
  onSendMessage: (payload: {
    content: string;
    contentType: MessageContentType;
    replyToMessageId?: string;
    attachments?: EncryptedAttachment[];
  }) => void;
  onEditMessage: (message: ChatMessage, content: string) => void;
  onTyping: () => void;
}

export const Composer: React.FC<ComposerProps> = ({
  chatId,
  replyingTo,
  editingMessage,
  onCancelReply,
  onCancelEdit,
  onSendMessage,
  onEditMessage,
  onTyping,
}) => {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<EncryptedAttachment[]>([]);
  const [showUploads, setShowUploads] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingStartedAtRef = useRef(0);
  const recordingChunksRef = useRef<Blob[]>([]);

  useEffect(() => () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    recorder?.stream.getTracks().forEach(track => track.stop());
  }, []);

  const startVoiceRecording = async () => {
    let stream: MediaStream | null = null;
    try {
      setVoiceError(null);
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ['audio/webm', 'audio/ogg'].find(type => MediaRecorder.isTypeSupported(type)) ?? '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recordingChunksRef.current = [];
      recordingStartedAtRef.current = Date.now();
      recorder.ondataavailable = event => { if (event.data.size > 0) recordingChunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const chunks = [...recordingChunksRef.current];
        const durationSeconds = Math.max(1, Math.round((Date.now() - recordingStartedAtRef.current) / 1000));
        recorder.stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);
        if (!chunks.length) { setVoiceError('The microphone produced no audio data.'); return; }
        void (async () => {
          setIsProcessingVoice(true);
          try {
            const recordedMimeType = (recorder.mimeType || 'audio/webm').split(';', 1)[0];
            const blob = new Blob(chunks, { type: recordedMimeType });
            const extension = blob.type.includes('ogg') ? 'ogg' : 'webm';
            const file = new File([blob], `voice-${Date.now()}.${extension}`, { type: blob.type });
            const uploadId = await globalUploadManager.startUpload(file, 'CHAT_ATTACHMENT');
            const completed = await globalUploadManager.waitForCompletion(uploadId);
            if (!completed.mediaId) throw new Error('Voice upload completed without a media ID.');
            const sizes = chunks.map(chunk => chunk.size);
            const maxSize = Math.max(1, ...sizes);
            const waveform = Array.from({ length: 32 }, (_, index) => Math.max(16, Math.round(((sizes[index % sizes.length] ?? 1) / maxSize) * 100)));
            const voice: EncryptedAttachment = { id: completed.mediaId, mediaFileId: completed.mediaId, name: file.name, type: 'voice', sizeBytes: file.size, mimeType: file.type, durationSeconds, waveform };
            setAttachments(current => [...current.filter(item => item.mediaFileId !== voice.mediaFileId), voice]);
          } catch (error) {
            setVoiceError(error instanceof Error ? error.message : 'Voice upload failed.');
          } finally {
            setIsProcessingVoice(false);
          }
        })();
      };
      recorderRef.current = recorder;
      recorder.start(500);
      setIsRecording(true);
    } catch (error) {
      stream?.getTracks().forEach(track => track.stop());
      setVoiceError(error instanceof Error ? error.message : 'Microphone access was denied.');
    }
  };

  const stopVoiceRecording = () => {
    if (recorderRef.current?.state !== 'inactive') recorderRef.current?.stop();
  };

  useEffect(() => {
    setText(editingMessage?.content ?? messageCacheManager.getDraft(chatId));
  }, [chatId, editingMessage]);

  const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    setText(value);
    messageCacheManager.setDraft(chatId, value);
    onTyping();
  };

  const handleSend = () => {
    const content = text.trim();
    if (!content && attachments.length === 0) return;
    if (editingMessage) {
      onEditMessage(editingMessage, content);
      setText('');
      onCancelEdit();
      return;
    }
    onSendMessage({
      content,
      contentType: attachments.length === 1 ? attachments[0].type.toUpperCase() as MessageContentType : 'TEXT',
      replyToMessageId: replyingTo?.id,
      attachments,
    });
    setText('');
    setAttachments([]);
    setShowUploads(false);
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

      {editingMessage && (
        <div className="flex items-center justify-between rounded-[var(--radius-xl)] border border-subtle bg-app p-2.5 text-xs">
          <div className="max-w-md space-y-0.5">
            <span className="font-semibold text-indigo-400">Editing message</span>
            <p className="truncate text-secondary">{editingMessage.content}</p>
          </div>
          <IconButton icon={<X className="h-4 w-4 text-tertiary" />} ariaLabel="Cancel edit" onClick={onCancelEdit} size="sm" />
        </div>
      )}

      <div className="flex items-end gap-2">
        <IconButton
          icon={<Paperclip className="h-4 w-4" />}
          ariaLabel="Attach a file"
          onClick={() => setShowUploads(value => !value)}
        />
        <IconButton
          icon={isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          ariaLabel={isRecording ? 'Stop voice recording' : 'Record a voice message'}
          onClick={isRecording ? stopVoiceRecording : () => void startVoiceRecording()}
          disabled={Boolean(editingMessage) || isProcessingVoice}
        />
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
            placeholder={editingMessage ? 'Edit encrypted message...' : 'Type an end-to-end encrypted message...'}
            rows={1}
            className="max-h-24 w-full resize-none bg-transparent text-sm text-primary outline-none placeholder-slate-500"
          />
        </div>
        <button
          type="button"
          aria-label="Send message"
          disabled={(!text.trim() && attachments.length === 0) || isRecording || isProcessingVoice}
          onClick={handleSend}
          className="rounded-[var(--radius-2xl)] bg-indigo-600 p-3 text-white shadow-token-lg transition-all hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
      {(isRecording || isProcessingVoice || voiceError) && <p className={`text-xs ${voiceError ? 'text-rose-400' : 'text-secondary'}`}>{voiceError ?? (isRecording ? 'Recording… press stop when finished.' : 'Uploading and validating voice message…')}</p>}
      {showUploads && !editingMessage && (
        <MediaUploadSubsystem
          compact
          context="CHAT_ATTACHMENT"
          onMediaReady={(item: MediaUploadItem) => setAttachments(current => current.some(att => att.mediaFileId === item.id) ? current : [...current, {
            id: item.id,
            mediaFileId: item.id,
            name: item.fileName,
            type: item.mimeType.startsWith('image/') ? 'image' : item.mimeType.startsWith('video/') ? 'video' : item.mimeType.startsWith('audio/') ? 'audio' : 'document',
            sizeBytes: item.fileSize,
            mimeType: item.mimeType,
            encryptedBlobUrl: item.previewUrl,
          }])}
        />
      )}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map(attachment => (
            <span key={attachment.mediaFileId} className="flex items-center gap-1 rounded-full border border-subtle px-2 py-1 text-xs">
              <span className="max-w-48 truncate">{attachment.name}</span>
              <button type="button" aria-label={`Remove ${attachment.name}`} onClick={() => setAttachments(current => current.filter(item => item.mediaFileId !== attachment.mediaFileId))}><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
