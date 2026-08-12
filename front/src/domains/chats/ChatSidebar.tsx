/**
 * Chat Sidebar Component
 * GAPAK Realtime E2EE Messenger
 *
 * Filterable conversation list with unread counters, online status indicators,
 * encryption badges, and quick triggers for new chat and device security console.
 */

import React, { useState } from 'react';
import {
  Search,
  Plus,
  Shield,
  MessageSquare,
  Users,
  Radio,
  Megaphone,
  Lock,
} from 'lucide-react';
import { Chat, ChatType } from '../../shared/types';
import { Avatar, Badge, IconButton, Button } from '../../shared/design-system/primitives';

interface ChatSidebarProps {
  chats: Chat[];
  activeChatId: string;
  onSelectChat: (chatId: string) => void;
  onOpenCreateModal: () => void;
  onOpenDevicesModal: () => void;
  wsState: string;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  chats,
  activeChatId,
  onSelectChat,
  onOpenCreateModal,
  onOpenDevicesModal,
  wsState,
}) => {
  const [filter, setFilter] = useState<'ALL' | ChatType>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredChats = chats.filter((c) => {
    if (filter !== 'ALL' && c.type !== filter) return false;
    if (searchQuery && !c.title?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="w-full sm:w-80 md:w-88 border-r border-subtle bg-surface flex flex-col h-full shrink-0">
      {/* Header Bar */}
      <div className="p-3 border-b border-subtle space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-base text-primary">Messages</h1>
            <span
              className={`w-2 h-2 rounded-[var(--radius-pill)] ${
                wsState === 'CONNECTED' ? 'bg-emerald-400' : 'bg-amber-400 animate-ping'
              }`}
            />
          </div>

          <div className="flex items-center gap-1">
            <IconButton
              icon={<Shield className="w-4 h-4 text-indigo-400" />}
              ariaLabel="Device security"
              onClick={onOpenDevicesModal}
            />
            <IconButton
              icon={<Plus className="w-4 h-4 text-white" />}
              ariaLabel="New chat"
              onClick={onOpenCreateModal}
            />
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-2 bg-app border border-subtle rounded-[var(--radius-xl)] flex items-center gap-2 text-xs">
          <Search className="w-4 h-4 text-muted" />
          <input
            type="text"
            placeholder="Search messages or keys..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-primary placeholder-slate-500 outline-none"
          />
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px] font-mono">
          {[
            { id: 'ALL', label: 'All' },
            { id: 'DIRECT', label: 'Direct' },
            { id: 'GROUP', label: 'Groups' },
            { id: 'CHANNEL', label: 'Channels' },
            { id: 'BROADCAST', label: 'Lists' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id as 'ALL' | ChatType)}
              className={`px-2.5 py-1 rounded-[var(--radius-lg)] transition-colors shrink-0 ${
                filter === tab.id
                  ? 'bg-indigo-600 text-white font-bold'
                  : 'bg-surface-glass text-tertiary hover:text-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredChats.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted">
            No conversations found in this filter.
          </div>
        ) : (
          filteredChats.map((chat) => {
            const isActive = chat.id === activeChatId;
            return (
              <div
                key={chat.id}
                onClick={() => onSelectChat(chat.id)}
                className={`p-3 rounded-[var(--radius-2xl)] cursor-pointer transition-all border ${
                  isActive
                    ? 'bg-indigo-950/40 border-indigo-500/40'
                    : 'bg-surface-glass border-transparent hover:bg-surface-strong'
                }`}
              >
                <div className="flex items-start gap-3">
                  <Avatar name={chat.title || 'Chat'} src={chat.avatarUrl} size="md" className="shrink-0" />

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-primary truncate">{chat.title}</span>
                      <span className="text-[10px] text-muted font-mono">
                        {new Date(chat.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs text-tertiary truncate">
                        {chat.lastMessage ? chat.lastMessage.content : 'Encrypted session established'}
                      </p>

                      {chat.unreadCount > 0 && (
                        <span className="px-1.5 py-0.5 bg-indigo-600 text-white text-[10px] font-bold rounded-[var(--radius-pill)] shrink-0">
                          {chat.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
