import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, MessageCircle, Radio, Search, ShieldCheck, SquarePen, UsersRound, X } from 'lucide-react';
import type { BackendPublicProfile } from '../../shared/api/backendContracts';
import type { Chat, ChatType } from '../../shared/types';
import { Avatar, IconButton } from '../../shared/design-system/primitives';
import { usersApi } from '../users/api/usersApi';
import { ProfileAvatar } from '../users/ProfileAvatar';

interface ChatSidebarProps {
  chats: Chat[];
  activeChatId: string;
  onSelectChat: (chatId: string) => void;
  onStartDirect: (profile: BackendPublicProfile) => void;
  onOpenCreateModal: () => void;
  onOpenDevicesModal: () => void;
  isCreatingDirect?: boolean;
  wsState: string;
  className?: string;
}

const chatPreview = (chat: Chat) => {
  if (chat.lastMessage?.content) return chat.lastMessage.content;
  if (chat.type === 'DIRECT') return 'Личная защищённая переписка';
  if (chat.type === 'GROUP') return `${chat.members.length || ''} участников · E2EE`;
  if (chat.type === 'CHANNEL') return 'Обновления канала';
  return 'Защищённая рассылка';
};

export const ChatSidebar: React.FC<ChatSidebarProps> = ({ chats, activeChatId, onSelectChat, onStartDirect, onOpenCreateModal, onOpenDevicesModal, isCreatingDirect = false, wsState, className = '' }) => {
  const [filter, setFilter] = useState<'ALL' | ChatType>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(searchQuery.trim()), 280);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const peopleQuery = useQuery({
    queryKey: ['users', 'chat-search', debouncedQuery],
    queryFn: ({ signal }) => usersApi.search(debouncedQuery, 8, signal),
    enabled: debouncedQuery.length >= 2,
    staleTime: 30_000,
  });

  const filteredChats = useMemo(() => chats.filter(chat => {
    if (filter !== 'ALL' && chat.type !== filter) return false;
    if (!searchQuery.trim()) return true;
    const needle = searchQuery.trim().toLowerCase();
    return `${chat.title ?? ''} ${chat.directPeer?.username ?? ''}`.toLowerCase().includes(needle);
  }), [chats, filter, searchQuery]);

  return <aside className={`h-full w-full shrink-0 flex-col overflow-hidden border-r border-subtle bg-surface lg:w-[340px] 2xl:w-[360px] ${className}`}>
    <div className="border-b border-subtle px-4 pb-3 pt-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5"><span className="bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-2xl font-black tracking-tight text-transparent">GAPAK</span><span className={`h-2 w-2 rounded-full ${wsState === 'CONNECTED' ? 'bg-emerald-400' : 'animate-pulse bg-amber-400'}`} title={wsState} /></div>
        <IconButton icon={<SquarePen className="h-4 w-4" />} ariaLabel="Новый чат" onClick={onOpenCreateModal} className="border border-subtle bg-surface-soft" />
      </div>
      <div className="flex h-11 items-center gap-2 rounded-2xl border border-subtle bg-app px-3 shadow-sm focus-within:border-indigo-500/60 focus-within:ring-2 focus-within:ring-indigo-500/10">
        <Search className="h-4 w-4 shrink-0 text-muted" />
        <input value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="Найти чат или пользователя" aria-label="Поиск чатов и пользователей" className="min-w-0 flex-1 bg-transparent text-sm text-primary outline-none placeholder:text-muted" />
        {searchQuery && <button type="button" onClick={() => setSearchQuery('')} aria-label="Очистить поиск" className="rounded-full p-1 text-muted hover:bg-surface-muted hover:text-primary"><X className="h-3.5 w-3.5" /></button>}
      </div>
      <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
        {([['ALL', 'Все'], ['DIRECT', 'Личные'], ['GROUP', 'Группы'], ['CHANNEL', 'Каналы']] as const).map(([id, label]) => <button key={id} type="button" onClick={() => setFilter(id)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${filter === id ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'bg-surface-soft text-secondary hover:bg-surface-hover hover:text-primary'}`}>{label}</button>)}
      </div>
    </div>

    <div className="flex-1 overflow-y-auto px-2 py-2">
      {debouncedQuery.length >= 2 && <section className="mb-3">
        <div className="flex items-center justify-between px-2 py-1.5"><span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Пользователи</span>{peopleQuery.isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />}</div>
        {peopleQuery.isError && <p className="px-2 py-2 text-xs text-rose-400">Не удалось выполнить поиск. Попробуйте ещё раз.</p>}
        {!peopleQuery.isFetching && !peopleQuery.isError && (peopleQuery.data ?? []).length === 0 && <p className="px-2 py-2 text-xs text-muted">Пользователь не найден</p>}
        {(peopleQuery.data ?? []).map(profile => <button key={profile.id} type="button" disabled={isCreatingDirect} onClick={() => onStartDirect(profile)} className="group flex w-full items-center gap-3 rounded-2xl px-2.5 py-2 text-left transition hover:bg-brand-soft disabled:opacity-60"><ProfileAvatar avatarFileId={profile.avatarFileId} name={profile.displayName || profile.username} size="md" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-primary">{profile.displayName || profile.username}</span><span className="block truncate text-xs text-tertiary">@{profile.username}</span></span><MessageCircle className="h-4 w-4 text-indigo-400 opacity-0 transition group-hover:opacity-100" /></button>)}
        <div className="mx-2 mt-2 border-b border-subtle" />
      </section>}

      <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Сообщения</div>
      {filteredChats.length === 0 ? <div className="mx-2 mt-4 rounded-2xl border border-dashed border-default p-6 text-center"><MessageCircle className="mx-auto mb-2 h-6 w-6 text-muted" /><p className="text-sm font-medium text-secondary">Чаты не найдены</p><p className="mt-1 text-xs text-muted">Найдите пользователя выше или создайте новый чат.</p></div> : filteredChats.map(chat => {
        const active = chat.id === activeChatId;
        return <button key={chat.id} type="button" onClick={() => onSelectChat(chat.id)} className={`mb-1 flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left transition ${active ? 'bg-gradient-to-r from-indigo-600/18 to-purple-500/10 ring-1 ring-inset ring-indigo-500/25' : 'hover:bg-surface-soft'}`}>
          <div className="relative shrink-0">{chat.type === 'DIRECT' ? <ProfileAvatar avatarFileId={chat.directPeer?.avatarFileId} name={chat.title || 'Chat'} size="md" /> : <Avatar name={chat.title || 'Chat'} src={chat.avatarUrl} size="md" />}</div>
          <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold text-primary">{chat.title}</span><span className="shrink-0 text-[10px] text-muted">{new Date(chat.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></span><span className="mt-0.5 flex items-center justify-between gap-2"><span className={`truncate text-xs ${active ? 'text-indigo-400' : 'text-tertiary'}`}>{chatPreview(chat)}</span>{chat.unreadCount > 0 && <span className="min-w-5 rounded-full bg-indigo-600 px-1.5 py-0.5 text-center text-[10px] font-bold text-white">{chat.unreadCount > 99 ? '99+' : chat.unreadCount}</span>}</span></span>
        </button>;
      })}
    </div>

    <div className="flex items-center justify-around border-t border-subtle bg-surface-subtle px-3 py-2">
      <button type="button" className="rounded-xl bg-indigo-600 p-2.5 text-white" aria-label="Сообщения"><MessageCircle className="h-4 w-4" /></button>
      <button type="button" onClick={onOpenCreateModal} className="rounded-xl p-2.5 text-tertiary hover:bg-surface-muted hover:text-primary" aria-label="Найти людей"><UsersRound className="h-4 w-4" /></button>
      <button type="button" className="rounded-xl p-2.5 text-tertiary hover:bg-surface-muted hover:text-primary" aria-label="Каналы" onClick={() => setFilter('CHANNEL')}><Radio className="h-4 w-4" /></button>
      <button type="button" onClick={onOpenDevicesModal} className="rounded-xl p-2.5 text-tertiary hover:bg-surface-muted hover:text-primary" aria-label="Защищённые устройства"><ShieldCheck className="h-4 w-4" /></button>
    </div>
  </aside>;
};
