/**
 * Recommendations Panel
 * GAPAK — right-rail "who to follow" widget for the main feed.
 *
 * Two sections:
 *  1. Discover — public accounts only, sorted "New" or "Top" (usersApi.discover).
 *  2. People you may know — public profiles sourced from the backend's
 *     mutual-connections graph (connectionsApi.suggestions). Private accounts
 *     are deliberately excluded by the server.
 */

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkles, TrendingUp, Users, UserPlus, Check, Lock, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usersApi } from '../users/api/usersApi';
import { connectionsApi } from './api/connectionsApi';
import type { BackendPublicProfile } from '../../shared/api/backendContracts';
import { Avatar, Button } from '../../shared/design-system/primitives';
import { useToast } from '../../shared/ux/ToastContext';
import { idempotencyKey } from '../../shared/ux/idempotencyKey';

const SuggestionRow: React.FC<{
  profile: BackendPublicProfile;
  subtitle: string;
  isPrivate?: boolean;
  onOpen: () => void;
  onFollow: () => void;
  isFollowed: boolean;
  isFollowing: boolean;
}> = ({ profile, subtitle, isPrivate, onOpen, onFollow, isFollowed, isFollowing }) => (
  <div className="flex items-center gap-2.5 py-2">
    <button type="button" onClick={onOpen} className="shrink-0">
      <Avatar name={profile.displayName || profile.username} size="sm" />
    </button>
    <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
      <span className="flex items-center gap-1 text-xs font-semibold text-primary truncate">
        <span className="truncate">{profile.displayName || profile.username}</span>
        {isPrivate ? <Lock className="w-3 h-3 text-muted shrink-0" /> : <Globe className="w-3 h-3 text-muted shrink-0" />}
      </span>
      <span className="block text-[10px] text-muted truncate">{subtitle}</span>
    </button>
    <Button
      variant={isFollowed ? 'secondary' : 'outline'}
      size="sm"
      disabled={isFollowed || isFollowing}
      onClick={onFollow}
      className="shrink-0 !px-2.5 !py-1 !text-[10px]"
    >
      {isFollowed ? <Check className="w-3 h-3" /> : <UserPlus className="w-3 h-3" />}
    </Button>
  </div>
);

export const RecommendationsPanel: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [discoverSort, setDiscoverSort] = useState<'new' | 'top'>('top');
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());

  const discoverQuery = useQuery({
    queryKey: ['users', 'discover', discoverSort],
    queryFn: ({ signal }) => usersApi.discover({ sort: discoverSort, limit: 6 }, signal),
    staleTime: 60_000,
  });

  const suggestionsQuery = useQuery({
    queryKey: ['connections', 'suggestions'],
    queryFn: ({ signal }) => connectionsApi.suggestions(6, signal),
    staleTime: 60_000,
  });

  const followMutation = useMutation({
    mutationFn: (userId: string) => connectionsApi.request(userId, idempotencyKey()),
    onSuccess: (_res, userId) => {
      setFollowedIds((prev) => new Set(prev).add(userId));
      void queryClient.invalidateQueries({ queryKey: ['connections'] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Unable to send follow request'),
  });

  const openProfile = (userId: string) => navigate(`/users/${encodeURIComponent(userId)}`);

  return (
    <aside className="hidden xl:flex w-72 shrink-0 flex-col gap-4 sticky top-3 self-start max-h-[calc(100vh-1.5rem)] overflow-y-auto">
      {/* Discover public accounts */}
      <div className="rounded-[var(--radius-3xl)] border border-subtle bg-surface p-4 shadow-token-sm">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold text-primary flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> Recommendations
          </h3>
        </div>
        <div className="flex items-center gap-1 mb-1 text-[11px] font-mono">
          <button
            type="button"
            onClick={() => setDiscoverSort('new')}
            className={`px-2.5 py-1 rounded-[var(--radius-lg)] flex items-center gap-1 transition-colors ${discoverSort === 'new' ? 'bg-indigo-600 text-white font-bold' : 'bg-surface-glass text-tertiary hover:text-primary'}`}
          >
            <Sparkles className="w-3 h-3" /> New
          </button>
          <button
            type="button"
            onClick={() => setDiscoverSort('top')}
            className={`px-2.5 py-1 rounded-[var(--radius-lg)] flex items-center gap-1 transition-colors ${discoverSort === 'top' ? 'bg-indigo-600 text-white font-bold' : 'bg-surface-glass text-tertiary hover:text-primary'}`}
          >
            <TrendingUp className="w-3 h-3" /> Top
          </button>
        </div>

        <div className="divide-y divide-subtle">
          {discoverQuery.isFetching && (
            <p className="text-[11px] text-muted py-3">Loading…</p>
          )}
          {!discoverQuery.isFetching && discoverQuery.isError && (
            <p className="text-[11px] text-rose-400 py-3">Couldn't load recommendations.</p>
          )}
          {!discoverQuery.isFetching && !discoverQuery.isError && (discoverQuery.data ?? []).length === 0 && (
            <p className="text-[11px] text-muted py-3">No public accounts to show right now.</p>
          )}
          {!discoverQuery.isFetching && (discoverQuery.data ?? []).map((profile) => (
            <SuggestionRow
              key={profile.id}
              profile={profile}
              subtitle={`@${profile.username}`}
              onOpen={() => openProfile(profile.id)}
              onFollow={() => followMutation.mutate(profile.id)}
              isFollowed={followedIds.has(profile.id)}
              isFollowing={followMutation.isPending && followMutation.variables === profile.id}
            />
          ))}
        </div>
      </div>

      {/* People you may know — server-ranked mutual public connections. */}
      <div className="rounded-[var(--radius-3xl)] border border-subtle bg-surface p-4 shadow-token-sm">
        <h3 className="text-xs font-bold text-primary flex items-center gap-1.5 mb-2">
          <Users className="w-3.5 h-3.5 text-emerald-400" /> People you may know
        </h3>
        <div className="divide-y divide-subtle">
          {suggestionsQuery.isFetching && (
            <p className="text-[11px] text-muted py-3">Loading…</p>
          )}
          {!suggestionsQuery.isFetching && suggestionsQuery.isError && (
            <p className="text-[11px] text-rose-400 py-3">Couldn't load suggestions.</p>
          )}
          {!suggestionsQuery.isFetching && !suggestionsQuery.isError && (suggestionsQuery.data ?? []).length === 0 && (
            <p className="text-[11px] text-muted py-3">No mutual-connection suggestions yet.</p>
          )}
          {!suggestionsQuery.isFetching && (suggestionsQuery.data ?? []).map(({ profile, mutualConnectionsCount }) => (
            <SuggestionRow
              key={profile.id}
              profile={profile}
              subtitle={mutualConnectionsCount > 0
                ? `${mutualConnectionsCount} mutual connection${mutualConnectionsCount === 1 ? '' : 's'}`
                : `@${profile.username}`}
              isPrivate={(profile.privacySettings?.profileVisibility ?? '').toUpperCase() !== 'PUBLIC'}
              onOpen={() => openProfile(profile.id)}
              onFollow={() => followMutation.mutate(profile.id)}
              isFollowed={followedIds.has(profile.id)}
              isFollowing={followMutation.isPending && followMutation.variables === profile.id}
            />
          ))}
        </div>
      </div>
    </aside>
  );
};
