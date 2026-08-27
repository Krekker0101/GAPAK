import React, { useEffect, useMemo, useState } from 'react';
import { FileText, Search, ShieldCheck, UserRound, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Chat, ChatMessage, EncryptedAttachment } from '../../shared/types';
import { Avatar, IconButton } from '../../shared/design-system/primitives';
import { mediaApi } from '../media/api/mediaApi';

const SharedImage: React.FC<{ attachment: EncryptedAttachment }> = ({ attachment }) => {
  const [url, setUrl] = useState(attachment.encryptedBlobUrl);
  useEffect(() => {
    let active = true;
    void mediaApi.requestPlaybackGrant(attachment.mediaFileId, 'CHAT_ATTACHMENT').then(grant => { if (active) setUrl(grant.request.url); }).catch(() => {});
    return () => { active = false; };
  }, [attachment.encryptedBlobUrl, attachment.mediaFileId]);
  if (!url) return <div className="aspect-square animate-pulse rounded-xl bg-surface-muted" />;
  return <button type="button" onClick={() => window.open(url, '_blank', 'noopener,noreferrer')} className="aspect-square overflow-hidden rounded-xl bg-surface-soft"><img src={url} alt={attachment.name} loading="lazy" decoding="async" className="h-full w-full object-cover transition hover:scale-105" /></button>;
};

interface Props {
  chat: Chat;
  messages: ChatMessage[];
  onClose: () => void;
  onSearch: () => void;
  onOpenDevices: () => void;
  className?: string;
}

export const ChatDetailsPanel: React.FC<Props> = ({ chat, messages, onClose, onSearch, onOpenDevices, className = '' }) => {
  const navigate = useNavigate();
  const peer = chat.type === 'DIRECT' ? chat.members.find(member => member.userId === chat.directPeer?.id)?.user ?? chat.directPeer : undefined;
  const attachments = useMemo(() => messages.flatMap(message => message.attachments ?? []), [messages]);
  const images = attachments.filter(attachment => attachment.type === 'image').slice(-6);
  const files = attachments.filter(attachment => !['image', 'video', 'audio', 'voice'].includes(attachment.type)).slice(-5);

  const openAttachment = async (attachment: EncryptedAttachment) => {
    const grant = await mediaApi.requestPlaybackGrant(attachment.mediaFileId, 'CHAT_ATTACHMENT');
    window.open(grant.request.url, '_blank', 'noopener,noreferrer');
  };

  return <aside className={`h-full w-[320px] shrink-0 overflow-y-auto border-l border-subtle bg-surface p-3 2xl:w-[336px] ${className}`}>
    <div className="rounded-3xl border border-subtle bg-gradient-to-br from-brand-soft via-surface to-surface p-5 shadow-sm">
      <div className="flex justify-end"><IconButton icon={<X className="h-4 w-4" />} ariaLabel="Закрыть информацию" onClick={onClose} size="sm" /></div>
      <div className="flex flex-col items-center text-center">
        <div className="relative"><Avatar name={chat.title || 'Chat'} src={chat.avatarUrl} size="xl" />{chat.type !== 'DIRECT' && <span className="absolute bottom-1 right-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-[var(--color-surface)] bg-indigo-500 px-1 text-[9px] font-bold text-white">{chat.members.length}</span>}</div>
        <h3 className="mt-3 text-lg font-bold text-primary">{chat.title}</h3>
        <p className="mt-0.5 text-xs font-medium text-tertiary">{chat.type === 'DIRECT' ? 'личный защищённый чат' : `${chat.members.length} участников`}</p>
        {peer?.username && <p className="mt-2 text-sm text-indigo-400">@{peer.username}</p>}
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2">
        <button type="button" onClick={() => peer?.id && navigate(`/users/${encodeURIComponent(peer.id)}`)} disabled={!peer?.id} className="flex flex-col items-center gap-1.5 rounded-2xl border border-subtle bg-surface/70 px-2 py-3 text-[10px] text-secondary transition hover:bg-surface-hover disabled:opacity-50"><UserRound className="h-4 w-4" />Профиль</button>
        <button type="button" onClick={onSearch} className="flex flex-col items-center gap-1.5 rounded-2xl border border-subtle bg-surface/70 px-2 py-3 text-[10px] text-secondary transition hover:bg-surface-hover"><Search className="h-4 w-4" />Поиск</button>
        <button type="button" onClick={onOpenDevices} className="flex flex-col items-center gap-1.5 rounded-2xl border border-subtle bg-surface/70 px-2 py-3 text-[10px] text-secondary transition hover:bg-surface-hover"><ShieldCheck className="h-4 w-4" />Защита</button>
      </div>
    </div>

    <section className="mt-3 rounded-3xl border border-subtle bg-surface-subtle p-4">
      <div className="mb-3 flex items-center justify-between"><h4 className="text-sm font-semibold text-primary">Общие медиа</h4><span className="text-xs text-indigo-400">{images.length}</span></div>
      {images.length ? <div className="grid grid-cols-3 gap-2">{images.map(attachment => <SharedImage key={attachment.id} attachment={attachment} />)}</div> : <p className="rounded-2xl bg-surface px-3 py-5 text-center text-xs text-muted">Изображений пока нет</p>}
    </section>

    <section className="mt-3 rounded-3xl border border-subtle bg-surface-subtle p-4">
      <div className="mb-2 flex items-center justify-between"><h4 className="text-sm font-semibold text-primary">Общие файлы</h4><span className="text-xs text-indigo-400">{files.length}</span></div>
      {files.length ? <div className="space-y-1">{files.map(attachment => <button key={attachment.id} type="button" onClick={() => void openAttachment(attachment)} className="flex w-full items-center gap-3 rounded-2xl p-2 text-left transition hover:bg-surface-hover"><span className="rounded-xl bg-indigo-500/10 p-2 text-indigo-400"><FileText className="h-4 w-4" /></span><span className="min-w-0"><span className="block truncate text-xs font-medium text-primary">{attachment.name}</span><span className="text-[10px] text-muted">{(attachment.sizeBytes / 1024).toFixed(1)} KB</span></span></button>)}</div> : <p className="rounded-2xl bg-surface px-3 py-5 text-center text-xs text-muted">Файлов пока нет</p>}
    </section>
  </aside>;
};
