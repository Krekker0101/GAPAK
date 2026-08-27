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
  const activeChatIdRef = useRef(chatId);
  const recordingStartedAtRef = useRef(0);
  const recordingChunksRef = useRef<Blob[]>([]);

  useEffect(() => () => {
    const recorder = recorderRef.current;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onstop = null;
    }
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    recorder?.stream.getTracks().forEach(track => track.stop());
  }, []);

  useEffect(() => {
    activeChatIdRef.current = chatId;
    const recorder = recorderRef.current;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      if (recorder.state !== 'inactive') recorder.stop();
      recorder.stream.getTracks().forEach(track => track.stop());
      recorderRef.current = null;
    }
    recordingChunksRef.current = [];
    setIsRecording(false);
    setIsProcessingVoice(false);
    setVoiceError(null);
    setAttachments([]);
    setShowUploads(false);
  }, [chatId]);

  const startVoiceRecording = async () => {
    const recordingChatId = chatId;
    let stream: MediaStream | null = null;
    try {
      setVoiceError(null);
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (activeChatIdRef.current !== recordingChatId) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
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
        if (!chunks.length) { setVoiceError('Микрофон не записал аудиоданные.'); return; }
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
            if (activeChatIdRef.current !== recordingChatId) return;
            const sizes = chunks.map(chunk => chunk.size);
            const maxSize = Math.max(1, ...sizes);
            const waveform = Array.from({ length: 32 }, (_, index) => Math.max(16, Math.round(((sizes[index % sizes.length] ?? 1) / maxSize) * 100)));
            const voice: EncryptedAttachment = { id: completed.mediaId, mediaFileId: completed.mediaId, name: file.name, type: 'voice', sizeBytes: file.size, mimeType: file.type, durationSeconds, waveform };
            setAttachments(current => {
              const withoutDuplicate = current.filter(item => item.mediaFileId !== voice.mediaFileId);
              if (withoutDuplicate.length >= 20) {
                setVoiceError('К одному сообщению можно прикрепить не более 20 файлов.');
                return current;
              }
              return [...withoutDuplicate, voice];
            });
          } catch (error) {
            if (activeChatIdRef.current === recordingChatId) setVoiceError(error instanceof Error ? error.message : 'Не удалось загрузить голосовое сообщение.');
          } finally {
            if (activeChatIdRef.current === recordingChatId) setIsProcessingVoice(false);
          }
        })();
      };
      recorderRef.current = recorder;
      recorder.start(500);
      setIsRecording(true);
    } catch (error) {
      stream?.getTracks().forEach(track => track.stop());
      setVoiceError(error instanceof Error ? error.message : 'Нет доступа к микрофону.');
    }
  };

  const stopVoiceRecording = () => {
    if (recorderRef.current?.state !== 'inactive') recorderRef.current?.stop();
  };

  useEffect(() => {
    setText(editingMessage?.content ?? messageCacheManager.getDraft(chatId));
    if (editingMessage) {
      setAttachments([]);
      setShowUploads(false);
    }
  }, [chatId, editingMessage]);

  const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    setText(value);
    if (!editingMessage) messageCacheManager.setDraft(chatId, value);
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
    <div className="space-y-2 border-t border-subtle bg-surface px-3 pb-3 pt-2 sm:px-4">
      {replyingTo && (
        <div className="flex items-center justify-between rounded-[var(--radius-xl)] border border-subtle bg-app p-2.5 text-xs">
          <div className="max-w-md space-y-0.5">
            <span className="font-semibold text-indigo-400">Ответ для {replyingTo.sender.displayName}</span>
            <p className="truncate text-secondary">{replyingTo.content}</p>
          </div>
          <IconButton icon={<X className="h-4 w-4 text-tertiary" />} ariaLabel="Cancel reply" onClick={onCancelReply} size="sm" />
        </div>
      )}

      {editingMessage && (
        <div className="flex items-center justify-between rounded-[var(--radius-xl)] border border-subtle bg-app p-2.5 text-xs">
          <div className="max-w-md space-y-0.5">
            <span className="font-semibold text-indigo-400">Редактирование сообщения</span>
            <p className="truncate text-secondary">{editingMessage.content}</p>
          </div>
          <IconButton icon={<X className="h-4 w-4 text-tertiary" />} ariaLabel="Cancel edit" onClick={onCancelEdit} size="sm" />
        </div>
      )}

      <div className="mx-auto flex max-w-4xl items-end gap-2 rounded-[22px] border border-default bg-app p-1.5 shadow-lg shadow-indigo-950/5 focus-within:border-indigo-500/50">
        <IconButton
          icon={<Paperclip className="h-4 w-4" />}
          ariaLabel="Прикрепить файл"
          onClick={() => setShowUploads(value => !value)}
        />
        <div className="flex min-h-10 flex-1 items-center gap-2 px-1">
          <textarea
            value={text}
            onChange={handleTextChange}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                handleSend();
              }
            }}
            placeholder={editingMessage ? 'Изменить сообщение…' : 'Напишите сообщение…'}
            maxLength={5000}
            rows={1}
            className="max-h-28 w-full resize-none bg-transparent py-2 text-sm text-primary outline-none placeholder:text-muted"
          />
        </div>
        <IconButton icon={isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />} ariaLabel={isRecording ? 'Остановить запись' : 'Записать голосовое сообщение'} onClick={isRecording ? stopVoiceRecording : () => void startVoiceRecording()} disabled={Boolean(editingMessage) || isProcessingVoice} className={isRecording ? 'bg-rose-500/10 text-rose-500' : ''} />
        <button
          type="button"
          aria-label="Send message"
          disabled={(!text.trim() && attachments.length === 0) || isRecording || isProcessingVoice}
          onClick={handleSend}
          className="rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 p-3 text-white shadow-lg shadow-indigo-600/25 transition hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
      {(isRecording || isProcessingVoice || voiceError) && <p className={`mx-auto max-w-4xl px-2 text-xs ${voiceError ? 'text-rose-400' : 'text-secondary'}`}>{voiceError ?? (isRecording ? 'Идёт запись… нажмите стоп, когда закончите.' : 'Загрузка и проверка голосового сообщения…')}</p>}
      {showUploads && !editingMessage && (
        <div className="mx-auto max-w-4xl rounded-3xl border border-subtle bg-surface-subtle p-2"><MediaUploadSubsystem
          compact
          context="CHAT_ATTACHMENT"
          onMediaReady={(item: MediaUploadItem) => setAttachments(current => {
            if (current.some(attachment => attachment.mediaFileId === item.id)) return current;
            if (current.length >= 20) {
              setVoiceError('К одному сообщению можно прикрепить не более 20 файлов.');
              return current;
            }
            return [...current, {
              id: item.id,
              mediaFileId: item.id,
              name: item.fileName,
              type: item.mimeType.startsWith('image/') ? 'image' : item.mimeType.startsWith('video/') ? 'video' : item.mimeType.startsWith('audio/') ? 'audio' : 'document',
              sizeBytes: item.fileSize,
              mimeType: item.mimeType,
              encryptedBlobUrl: item.previewUrl,
            }];
          })}
        /></div>
      )}
      {attachments.length > 0 && (
        <div className="mx-auto flex max-w-4xl flex-wrap gap-2">
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
