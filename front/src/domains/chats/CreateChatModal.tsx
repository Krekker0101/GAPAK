/**
 * Create Chat Modal Component
 * GAPAK Realtime E2EE Messenger
 *
 * Creation UI for DIRECT, GROUP, CHANNEL, and BROADCAST capabilities.
 */

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  MessageSquare,
  Users,
  Radio,
  Megaphone,
  Lock,
  Check,
  Search,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react';
import { ChatType } from '../../shared/types';
import type { BackendPublicProfile } from '../../shared/api/backendContracts';
import { usersApi } from '../users/api/usersApi';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Avatar,
} from '../../shared/design-system/primitives';

const useDebouncedValue = (value: string, delayMs: number) => {
  const [debounced, setDebounced] = useState(value);
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
};

interface CreateChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateChat: (payload: {
    type: ChatType;
    title?: string;
    description?: string;
    memberIds: string[];
  }) => void;
}

export const CreateChatModal: React.FC<CreateChatModalProps> = ({
  isOpen,
  onClose,
  onCreateChat,
}) => {
  const [selectedType, setSelectedType] = useState<ChatType>('DIRECT');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [participantInput, setParticipantInput] = useState('');
  const [pickedUsers, setPickedUsers] = useState<BackendPublicProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [discoverSort, setDiscoverSort] = useState<'new' | 'top'>('new');
  const debouncedQuery = useDebouncedValue(searchQuery.trim(), 300);

  React.useEffect(() => {
    if (isOpen) return;
    setSelectedType('DIRECT');
    setTitle('');
    setDescription('');
    setParticipantInput('');
    setPickedUsers([]);
    setSearchQuery('');
  }, [isOpen]);

  const manualIds = participantInput.split(',').map((value) => value.trim()).filter(Boolean);
  const pickedIds = pickedUsers.map((u) => u.id);
  const selectedUserIds = useMemo(
    () => Array.from(new Set([...pickedIds, ...manualIds])),
    [pickedIds, manualIds],
  );

  const searchResultsQuery = useQuery({
    queryKey: ['users', 'search', debouncedQuery],
    queryFn: ({ signal }) => usersApi.search(debouncedQuery, 15, signal),
    enabled: debouncedQuery.length >= 2,
  });

  const discoverQuery = useQuery({
    queryKey: ['users', 'discover', discoverSort],
    queryFn: ({ signal }) => usersApi.discover({ sort: discoverSort, limit: 12 }, signal),
    enabled: debouncedQuery.length < 2,
    staleTime: 60_000,
  });

  const isSearching = debouncedQuery.length >= 2;
  const rawResults = isSearching ? (searchResultsQuery.data ?? []) : (discoverQuery.data ?? []);
  const suggestions = rawResults.filter((profile) => !pickedIds.includes(profile.id));
  const suggestionsLoading = isSearching ? searchResultsQuery.isFetching : discoverQuery.isFetching;
  const suggestionsError = isSearching ? searchResultsQuery.isError : discoverQuery.isError;

  const togglePick = (profile: BackendPublicProfile) => {
    setParticipantInput('');
    setPickedUsers((prev) => {
      if (prev.some((u) => u.id === profile.id)) return prev.filter((u) => u.id !== profile.id);
      return selectedType === 'DIRECT' ? [profile] : [...prev, profile];
    });
  };

  const handleCreate = () => {
    if (selectedUserIds.length === 0) return;
    onCreateChat({
      type: selectedType,
      title: title || (selectedType === 'DIRECT' ? pickedUsers[0]?.displayName || pickedUsers[0]?.username : 'Новый чат'),
      description,
      memberIds: selectedUserIds,
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalHeader>
        <h3 className="font-bold text-base text-primary">Новый чат</h3>
      </ModalHeader>

      <ModalBody className="space-y-4">
        {/* Chat Type Selection Grid */}
        <div className="grid grid-cols-2 gap-2">
          {[
            {
              type: 'DIRECT' as ChatType,
              label: 'Личный чат',
              desc: 'Один на один, E2EE',
              icon: <MessageSquare className="w-4 h-4 text-indigo-400" />,
            },
            {
              type: 'GROUP' as ChatType,
              label: 'Группа',
              desc: 'Общение с участниками',
              icon: <Users className="w-4 h-4 text-purple-400" />,
            },
            {
              type: 'CHANNEL' as ChatType,
              label: 'Канал',
              desc: 'Публикации для подписчиков',
              icon: <Radio className="w-4 h-4 text-emerald-400" />,
            },
            {
              type: 'BROADCAST' as ChatType,
              label: 'Рассылка',
              desc: 'Сообщение нескольким людям',
              icon: <Megaphone className="w-4 h-4 text-amber-400" />,
            },
          ].map((item) => (
            <button
              key={item.type}
              type="button"
              onClick={() => {
                setSelectedType(item.type);
                if (item.type === 'DIRECT') {
                  setPickedUsers((current) => current.slice(0, 1));
                  setParticipantInput('');
                }
              }}
              className={`p-3 rounded-[var(--radius-xl)] border text-left transition-all flex flex-col justify-between ${
                selectedType === item.type
                  ? 'bg-indigo-950/40 border-indigo-500/50 ring-1 ring-indigo-500/30'
                  : 'bg-surface border-subtle hover:border-default'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                {item.icon}
                {selectedType === item.type && <Check className="w-3.5 h-3.5 text-indigo-400" />}
              </div>
              <div className="mt-2">
                <p className="text-xs font-bold text-primary">{item.label}</p>
                <p className="text-[10px] text-tertiary">{item.desc}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Title & Description if not Direct */}
        {selectedType !== 'DIRECT' && (
          <div className="space-y-3 pt-2">
            <Input
              label="Название"
              placeholder="Например, Команда GAPAK"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Input
              label="Описание (необязательно)"
              placeholder="О чём этот чат"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        )}

        {/* Members Selection */}
        <div className="space-y-2 pt-2">
          <label className="text-xs font-mono uppercase tracking-wider text-tertiary">Выберите участников</label>

          <div className="p-2 bg-app border border-subtle rounded-[var(--radius-xl)] flex items-center gap-2 text-xs">
            <Search className="w-4 h-4 text-muted shrink-0" />
            <input
              type="text"
              placeholder="Поиск по имени пользователя…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-primary placeholder-slate-500 outline-none"
            />
          </div>

          {/* Picked chips */}
          {pickedUsers.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {pickedUsers.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => togglePick(u)}
                  className="flex items-center gap-1 pl-1 pr-2 py-1 rounded-[var(--radius-pill)] bg-indigo-600/20 border border-indigo-500/40 text-[11px] text-indigo-200"
                >
                  <Avatar name={u.displayName || u.username} size="xs" />
                  @{u.username}
                  <X className="w-3 h-3" />
                </button>
              ))}
            </div>
          )}

          {/* Recommendations toggle (only shown while not actively searching) */}
          {!isSearching && (
            <div className="flex items-center gap-1 text-[11px] font-mono">
              <button
                type="button"
                onClick={() => setDiscoverSort('new')}
                className={`px-2.5 py-1 rounded-[var(--radius-lg)] flex items-center gap-1 transition-colors ${discoverSort === 'new' ? 'bg-indigo-600 text-white font-bold' : 'bg-surface-glass text-tertiary hover:text-primary'}`}
              >
                <Sparkles className="w-3 h-3" /> Новые
              </button>
              <button
                type="button"
                onClick={() => setDiscoverSort('top')}
                className={`px-2.5 py-1 rounded-[var(--radius-lg)] flex items-center gap-1 transition-colors ${discoverSort === 'top' ? 'bg-indigo-600 text-white font-bold' : 'bg-surface-glass text-tertiary hover:text-primary'}`}
              >
                <TrendingUp className="w-3 h-3" /> Популярные
              </button>
            </div>
          )}

          {/* Results list */}
          <div className="max-h-40 overflow-y-auto space-y-1 rounded-[var(--radius-xl)] border border-subtle p-1.5 bg-surface">
            {suggestionsLoading && (
              <p className="text-[11px] text-muted px-2 py-2">Загрузка…</p>
            )}
            {!suggestionsLoading && suggestionsError && (
              <p className="text-[11px] text-rose-400 px-2 py-2">Не удалось загрузить {isSearching ? 'результаты поиска' : 'рекомендации'}.</p>
            )}
            {!suggestionsLoading && !suggestionsError && suggestions.length === 0 && (
              <p className="text-[11px] text-muted px-2 py-2">
                {isSearching ? 'Пользователь с таким именем не найден.' : 'Пока нет рекомендаций.'}
              </p>
            )}
            {!suggestionsLoading && !suggestionsError && suggestions.map((profile) => (
              <button
                key={profile.id}
                type="button"
                onClick={() => togglePick(profile)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-[var(--radius-lg)] hover:bg-surface-glass text-left transition-colors"
              >
                <Avatar name={profile.displayName || profile.username} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-primary truncate">{profile.displayName || profile.username}</span>
                  <span className="block text-[10px] text-muted truncate">@{profile.username}</span>
                </span>
                <Check className={`w-3.5 h-3.5 shrink-0 ${pickedIds.includes(profile.id) ? 'text-indigo-400' : 'text-transparent'}`} />
              </button>
            ))}
          </div>

          {selectedType !== 'DIRECT' && <details className="text-[10px] text-muted">
            <summary className="cursor-pointer select-none">Добавить по ID пользователя</summary>
            <Input
              className="mt-2"
              placeholder="ID пользователей через запятую"
              value={participantInput}
              onChange={(e) => setParticipantInput(e.target.value)}
            />
          </details>}
        </div>
      </ModalBody>

      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>
          Отмена
        </Button>
        <Button
          variant="primary"
          onClick={handleCreate}
          disabled={selectedUserIds.length === 0 || (selectedType === 'DIRECT' && selectedUserIds.length !== 1)}
        >
          {selectedType === 'DIRECT' ? 'Начать общение' : 'Создать чат'}
        </Button>
      </ModalFooter>
    </Modal>
  );
};
