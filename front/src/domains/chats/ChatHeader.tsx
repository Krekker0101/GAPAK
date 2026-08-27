import React from 'react';
import { ArrowLeft, MoreVertical, PanelRight, Search, ShieldCheck, X } from 'lucide-react';
import type { Chat, UserPresenceData } from '../../shared/types';
import { Avatar, IconButton } from '../../shared/design-system/primitives';
import { ProfileAvatar } from '../users/ProfileAvatar';

interface ChatHeaderProps {
  chat: Chat;
  presence?: UserPresenceData;
  typingText?: string;
  searchQuery: string;
  searchOpen: boolean;
  onSearchChange: (value: string) => void;
  onSearchOpenChange: (open: boolean) => void;
  onBack: () => void;
  onToggleDetails: () => void;
  onOpenDevicesModal: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({ chat, presence, typingText, searchQuery, searchOpen, onSearchChange, onSearchOpenChange, onBack, onToggleDetails, onOpenDevicesModal }) => {
  const closeSearch = () => { onSearchOpenChange(false); onSearchChange(''); };

  return <header className="relative flex min-h-[72px] shrink-0 items-center justify-between gap-3 border-b border-subtle bg-surface/95 px-3 backdrop-blur-xl sm:px-4">
    <div className="flex min-w-0 items-center gap-2.5">
      <IconButton icon={<ArrowLeft className="h-5 w-5" />} ariaLabel="Назад к чатам" onClick={onBack} className="lg:hidden" />
      <div className="relative">{chat.type === 'DIRECT' ? <ProfileAvatar avatarFileId={chat.directPeer?.avatarFileId} name={chat.title || 'Chat'} size="md" /> : <Avatar name={chat.title || 'Chat'} src={chat.avatarUrl} size="md" />}{presence?.status === 'online' && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[var(--color-surface)] bg-emerald-400" />}</div>
      <div className="min-w-0"><h2 className="truncate text-[15px] font-bold text-primary sm:text-base">{chat.title}</h2><p className={`truncate text-xs ${typingText ? 'font-medium text-indigo-400' : presence?.status === 'online' ? 'text-emerald-500' : 'text-tertiary'}`}>{typingText || (presence?.status === 'online' ? 'в сети' : presence?.status === 'away' ? 'неактивен' : presence?.status === 'offline' ? 'не в сети' : chat.type === 'DIRECT' ? 'защищённый чат' : `${chat.members.length} участников`)}</p></div>
    </div>

    <div className="flex min-w-0 items-center justify-end gap-1">
      {searchOpen && <div className="absolute left-3 right-3 top-[76px] z-30 flex h-11 items-center gap-2 rounded-2xl border border-subtle bg-surface px-3 shadow-xl md:static md:h-10 md:w-48 md:bg-app md:shadow-none xl:w-64"><Search className="h-4 w-4 text-muted" /><input autoFocus value={searchQuery} onChange={event => onSearchChange(event.target.value)} placeholder="Поиск в чате" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted" /><button type="button" onClick={closeSearch} aria-label="Закрыть поиск"><X className="h-4 w-4 text-muted" /></button></div>}
      <IconButton icon={<Search className="h-5 w-5" />} ariaLabel="Поиск в чате" onClick={() => searchOpen ? closeSearch() : onSearchOpenChange(true)} />
      <IconButton icon={<ShieldCheck className="h-5 w-5" />} ariaLabel="Защищённые устройства" onClick={onOpenDevicesModal} className="hidden sm:inline-flex" />
      <IconButton icon={<PanelRight className="h-5 w-5" />} ariaLabel="Информация о чате" onClick={onToggleDetails} />
      <IconButton icon={<MoreVertical className="h-5 w-5" />} ariaLabel="Дополнительные действия" onClick={onToggleDetails} className="hidden sm:inline-flex" />
    </div>
  </header>;
};
